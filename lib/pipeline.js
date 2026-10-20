import {fetchJSON,normalizePlaces,gemini,parseJSON,aiDiagnostic,aiFailureMessage,AppError} from './core.js';
export async function placesSearch(q,signal){
 const r=await fetchJSON('https://places.googleapis.com/v1/places:searchText',{method:'POST',signal,headers:{'Content-Type':'application/json','X-Goog-Api-Key':process.env.GOOGLE_MAPS_API_KEY,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus,places.attributions'},body:JSON.stringify({textQuery:`日本 ${q.city} ${q.food} レストラン`,languageCode:'ja',regionCode:'JP',includedType:'restaurant',strictTypeFiltering:true,pageSize:6,locationRestriction:{rectangle:{low:{latitude:20,longitude:122},high:{latitude:46,longitude:154}}}})},10000);
 return normalizePlaces(r.places);
}
export const rankingSchema={type:'object',properties:{restaurants:{type:'array',items:{type:'object',properties:{id:{type:'string'},reason:{type:'string'}},required:['id','reason'],additionalProperties:false}}},required:['restaurants'],additionalProperties:false};
export async function rankPlaces(q,places,signal){
 const candidates=places.map(p=>({id:p.id,name:p.name,address:p.address,rating:p.rating,reviews:p.reviews}));
 const r=await gemini(`Return JSON {"restaurants":[{"id":"candidate id","reason":"Korean, <=100 characters"}]}. Rank only the supplied candidates based on menu/location/preferences and Google rating and review count. Do not invent facts about price, menus, opening hours, queue, reservations or ambience. Do not include numeric ratings in reason. Ground reason only in supplied fields. Data: ${JSON.stringify({request:q,places:candidates})}`,{json:true,schema:rankingSchema,signal,timeout:16000,stage:'ranking'});
 const rows=parseJSON(r.text)?.restaurants;if(!Array.isArray(rows)){const e=new AppError('AI 정렬 응답 형식이 올바르지 않습니다.');e.code='invalid_ranking';throw e;}
 const used=new Set();const result=[];
 for(const row of rows){const p=places.find(p=>p.id===row?.id);if(p&&!used.has(p.id)&&typeof row.reason==='string'&&row.reason.trim()){used.add(p.id);result.push({...p,reason:row.reason.trim().slice(0,200),aiRecommended:true});}}
 if(!result.length){const e=new AppError('AI가 유효한 식당 ID를 반환하지 않았습니다.');e.code='invalid_ranking';throw e;}
 return [...result,...places.filter(p=>!used.has(p.id))];
}
export async function runSearch(q,emit,signal,deps={placesSearch,rankPlaces}){
 let places=(await deps.placesSearch(q,signal)).map(p=>({...p,aiRecommended:false,reason:'Google 검색 결과입니다.'}));
 if(signal.aborted)return;
 emit({type:'places',restaurants:places});
 if(!places.length){emit({type:'done',restaurants:[],aiRanked:false});return;}
 if(signal.aborted)return;
 emit({type:'stage',stage:'ranking'});
 let aiRanked=false;
 try{places=await deps.rankPlaces(q,places,signal);aiRanked=true;}
 catch(e){if(!signal.aborted){console.warn('ai_ranking',{stage:'ranking',...aiDiagnostic(e)});emit({type:'warning',message:`${aiFailureMessage(e)} Google 검색 순서를 유지했어요.`});}}
 if(!signal.aborted)emit({type:'done',restaurants:places,aiRanked});
}
