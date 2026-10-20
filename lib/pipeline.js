import {crawlTabelog} from './tabelog.js';
import {fetchJSON,normalizePlaces,gemini,resolveSource,safeURL,parseJSON,validatePage,tabelogURL} from './core.js';
export async function placesSearch(q,signal){
 const r=await fetchJSON('https://places.googleapis.com/v1/places:searchText',{method:'POST',signal,headers:{'Content-Type':'application/json','X-Goog-Api-Key':process.env.GOOGLE_MAPS_API_KEY,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus,places.attributions'},body:JSON.stringify({textQuery:`日本 ${q.city} ${q.food} レストラン`,languageCode:'ja',regionCode:'JP',includedType:'restaurant',strictTypeFiltering:true,pageSize:6,locationRestriction:{rectangle:{low:{latitude:20,longitude:122},high:{latitude:46,longitude:154}}}})},10000);
 return normalizePlaces(r.places);
}
export async function inspectPlace(place,signal,emit){
 let search;
 try{search=await gemini(`Find the exact Tabelog restaurant detail URL for this Japanese restaurant branch. Match the street address. Return a short statement of the name, address and direct restaurant URL with citation. Do not quote reviews or return ratings. Data: ${JSON.stringify(place)}`,{grounded:true,signal,timeout:16000});}
 catch(e){console.info('tabelog_lookup',{stage:'search',status:e?.name==='TimeoutError'?'timeout':'api_error'});return {tabelog:null,lookupStatus:'search_failed',message:'타베로그 검색 요청이 실패했어요. 잠시 후 다시 시도해 주세요.'};}
 const chunks=(search.metadata.groundingChunks||[]).slice(0,5);
 const sources=await Promise.all(chunks.map(async c=>({title:String(c.web?.title||'검색 출처'),url:safeURL(c.web?.uri),tabelogUrl:await resolveSource(c.web?.uri,signal)})));
 emit({type:'sources',id:place.id,sources,suggestions:search.metadata.searchEntryPoint?.renderedContent||''});
 // Text URLs are only discovery hints; the server must still verify page identity and rating.
 const textURLs=(search.text.match(/https:\/\/(?:www\.)?tabelog\.com\/[^\s<>"')\]]+/g)||[]).map(tabelogURL).filter(Boolean);
 const urls=[...new Set([...sources.map(s=>s.tabelogUrl).filter(Boolean),...textURLs])].slice(0,2);
 if(!urls.length)return {tabelog:null,lookupStatus:'url_not_found',message:'해당 지점의 타베로그 페이지를 찾지 못했어요.'};
 const crawl=await crawlTabelog(place,urls[0],signal);
 console.info('tabelog_lookup',{stage:'html',status:crawl.status});
 if(crawl.tabelog)return {tabelog:crawl.tabelog,tabelogUrl:urls[0],lookupStatus:'html_found',message:'공개 페이지에서 식당 종합점수를 확인했어요.'};
 if(signal.aborted)return {tabelog:null,lookupStatus:'cancelled',tabelogUrl:urls[0]};
 try{
  const page=await gemini(`Use URL Context to READ these exact pages: ${urls.join(' ')}. Identify the matching branch by actual page name and street address, not by copying input. Extract the restaurant OVERALL Tabelog rating, never a user's individual rating. Return ONLY JSON text (no fences): {"url":"one of supplied URLs","name":"name read from page","address":"Japanese street address read from page","branchMatch":true,"score":3.50}. Use null score and false branchMatch if retrieval fails, score is absent or branch uncertain. Do not infer values. Candidate data: ${JSON.stringify({name:place.name,address:place.address})}`,{urlContext:true,signal,timeout:14000});
  const row=parseJSON(page.text);const url=urls.find(u=>u===tabelogURL(row.url));
  const tabelog=url?validatePage(place,row,url,page.urlMetadata):null;
  const items=page.urlMetadata.urlMetadata||page.urlMetadata.url_metadata||[];
  const retrieved=items.some(m=>urls.includes(tabelogURL(m.retrievedUrl||m.retrieved_url))&&(m.urlRetrievalStatus||m.url_retrieval_status)==='URL_RETRIEVAL_STATUS_SUCCESS');
  const status=tabelog?'context_found':retrieved?'branch_or_score_unconfirmed':'page_unreadable';
  console.info('tabelog_lookup',{stage:'url_context',status});
  return {tabelog,tabelogUrl:urls[0],lookupStatus:status,message:tabelog?'페이지 읽기 결과예요. 최신 점수는 원문을 확인해 주세요.':retrieved?'페이지는 읽었지만 지점 또는 종합점수를 대조하지 못했어요.':'페이지 접근이 제한되었거나 본문을 읽지 못했어요.'};
 }catch(e){
  console.info('tabelog_lookup',{stage:'url_context',status:e?.name==='TimeoutError'?'timeout':'api_or_parse_error'});
  const blocked=['access_blocked','robots_disallowed'].includes(crawl.status);
  return {tabelog:null,tabelogUrl:urls[0],lookupStatus:blocked?'access_blocked':'lookup_failed',message:blocked?'타베로그 접근 제한으로 점수를 읽지 못했어요. 후보 페이지에서 지점을 확인해 주세요.':'페이지 읽기 요청이 실패했어요. 후보 페이지에서 직접 확인해 주세요.'};
 }
}
export async function rankPlaces(q,places,signal){
 const r=await gemini(`Return JSON {"restaurants":[{"id":"candidate id","reason":"Korean, <=100 characters"}]}. Rank only the supplied candidates based on menu/location/preferences and available rating evidence. Do not invent facts about price, menus, opening hours, queue, reservations or ambience. Unknown Tabelog is missing data, not zero. Only first three Google results were checked; do not treat checked as inherently better. Google and Tabelog are different scales; do not average. Do not include numeric ratings in reason. Ground reason only in supplied fields. Data: ${JSON.stringify({request:q,places})}`,{json:true,signal,timeout:10000});
 const rows=parseJSON(r.text).restaurants;if(!Array.isArray(rows))throw Error('invalid ranking');
 const used=new Set();const result=[];
 for(const row of rows){const p=places.find(p=>p.id===row?.id);if(p&&!used.has(p.id)){used.add(p.id);result.push({...p,reason:typeof row.reason==='string'?row.reason.slice(0,200):p.reason});}}
 if(!result.length)throw Error('empty ranking');
 return [...result,...places.filter(p=>!used.has(p.id))];
}
export async function runSearch(q,emit,signal,deps={placesSearch,inspectPlace,rankPlaces}){
 let places=(await deps.placesSearch(q,signal)).map((p,i)=>({...p,checkStatus:i<3?'pending':'skipped',tabelog:null,reason:'검색 조건에 맞춰 찾은 식당입니다.'}));
 emit({type:'places',restaurants:places,checkedCount:Math.min(3,places.length)});
 if(!places.length){emit({type:'done',restaurants:[],aiRanked:false});return;}
 await Promise.all(places.slice(0,3).map(async p=>{
  let patch;try{patch=await deps.inspectPlace(p,signal,emit);}catch{patch={tabelog:null,message:'시간 초과 또는 조회 실패 · 원문에서 확인해 주세요.'};}
  if(signal.aborted)return;
  Object.assign(p,patch,{checkStatus:patch.tabelog?'found':'unknown'});emit({type:'detail',restaurant:p});
 }));
 if(signal.aborted)return;
 emit({type:'stage',stage:'ranking'});
 let aiRanked=false;
 try{places=await deps.rankPlaces(q,places,signal);aiRanked=true;}catch{emit({type:'warning',message:'AI 정렬을 완료하지 못해 Google 검색 순서를 유지했어요.'});}
 if(!signal.aborted)emit({type:'done',restaurants:places,aiRanked});
}

