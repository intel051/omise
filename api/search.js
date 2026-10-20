import {input,fetchJSON} from '../lib/core.js';
import {authorize,failure,requireMaps,fieldMask,placeView,sign} from '../lib/http.js';
export default async function handler(req,res){try{
 authorize(req,res);requireMaps();const q=input(req.body);const isCafe=/카페|珈琲|コーヒー|coffee|caf[eé]|喫茶/i.test(q.food);
 const data=await fetchJSON('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':process.env.GOOGLE_MAPS_API_KEY,'X-Goog-FieldMask':fieldMask.split(',').map(f=>'places.'+f).join(',')},body:JSON.stringify({textQuery:`日本 ${q.city} ${q.food} ${isCafe?'カフェ':'レストラン'}`,languageCode:'ja',regionCode:'JP',includedType:isCafe?'cafe':'restaurant',strictTypeFiltering:true,pageSize:12,locationRestriction:{rectangle:{low:{latitude:20,longitude:122},high:{latitude:46,longitude:154}}}})},12000);
 const places=(data.places||[]).filter(p=>p.id&&!['CLOSED_PERMANENTLY','CLOSED_TEMPORARILY'].includes(p.businessStatus)).map(placeView);
 const candidates=places.map(({id,name,address,rating,reviews})=>({id,name,address,rating,reviews}));
 res.status(200).json({places,recommendationToken:places.length&&process.env.GEMINI_API_KEY?sign('recommend',{q,places:candidates}):null});
}catch(e){failure(res,e);}}
