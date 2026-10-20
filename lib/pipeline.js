import {gemini,parseJSON,AppError} from './core.js';
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
