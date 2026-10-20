import {gemini,parseJSON,AppError} from './core.js';
export const rankingSchema={type:'object',properties:{restaurants:{type:'array',maxItems:12,items:{type:'object',properties:{index:{type:'integer',minimum:0,maximum:11},reason:{type:'string',maxLength:60}},required:['index','reason'],additionalProperties:false}}},required:['restaurants'],additionalProperties:false};
export async function rankPlaces(q,places,signal,{timeout=28000,quick=false}={}){
 const candidates=places.map((p,index)=>({index,name:p.name,rating:p.rating,reviews:p.reviews}));
 const r=await gemini(`Rank supplied restaurants by the user's menu/area/preferences and Google rating/review count. Return {"restaurants":[{"index":0,"reason":"short Korean reason"}]} with each supplied index once, best first. Reason must be one Korean sentence under ${quick?25:35} characters. Only use supplied facts; never invent price, menus, opening hours, distance, queues or ambience. No numeric ratings in reasons. Data: ${JSON.stringify({request:q,candidates})}`,{json:true,schema:rankingSchema,signal,timeout,stage:quick?'ranking_retry':'ranking',maxOutputTokens:2048});
 const rows=parseJSON(r.text)?.restaurants;if(!Array.isArray(rows)){const e=new AppError('AI 정렬 응답 형식이 올바르지 않습니다.');e.code='invalid_ranking';throw e;}
 const used=new Set(),result=[];
 for(const row of rows){const index=row?.index,p=Number.isInteger(index)?places[index]:null;if(p&&!used.has(index)&&typeof row.reason==='string'&&row.reason.trim()){used.add(index);result.push({...p,reason:row.reason.trim().slice(0,60),aiRecommended:true});}}
 if(!result.length){const e=new AppError('AI가 유효한 식당 번호를 반환하지 않았습니다.');e.code='invalid_ranking';throw e;}
 return [...result,...places.filter((p,i)=>!used.has(i))];
}
export async function recommendWithRetry(q,places,signal,rank=rankPlaces){
 try{return {ranked:await rank(q,places,signal),partial:false,retried:false};}
 catch(e){
  // Never retry auth, quota, validation errors or a cancelled parent request.
  if(signal.aborted||e?.name!=='TimeoutError')throw e;
  const limited=places.slice(0,6);
  console.info('ai_ranking_retry',{reason:'timeout',candidates:limited.length});
  return {ranked:await rank(q,limited,signal,{timeout:12000,quick:true}),partial:places.length>limited.length,retried:true};
 }
}
