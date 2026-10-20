import {timingSafeEqual,createHmac} from 'node:crypto';
import {AppError,fetchJSON,safeURL} from './core.js';
export function authorize(req,res,method='POST'){
 res.setHeader('Cache-Control','no-store');
 if(req.method!==method){res.setHeader('Allow',method);throw new AppError('지원하지 않는 요청입니다.',405);}
 if(Number(req.headers['content-length']||0)>20000)throw new AppError('요청이 너무 큽니다.',413);
 if(process.env.APP_PASSWORD){const a=Buffer.from(String(req.headers['x-app-password']||'')),b=Buffer.from(process.env.APP_PASSWORD);if(a.length!==b.length||!timingSafeEqual(a,b))throw new AppError('사이트 비밀번호를 입력하거나 확인해 주세요.',401);}
}
export const failure=(res,e)=>res.status(e.status||502).json({error:e instanceof AppError?e.message:'요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'});
export const requireMaps=()=>{if(!process.env.GOOGLE_MAPS_API_KEY)throw new AppError('Google Places API 키가 설정되지 않았습니다.',503);};
const secret=()=>process.env.GOOGLE_MAPS_API_KEY||process.env.GEMINI_API_KEY||'';
export function sign(kind,data,ttl=1800000){const payload=Buffer.from(JSON.stringify({kind,data,expires:Date.now()+ttl})).toString('base64url');return payload+'.'+createHmac('sha256',secret()).update(payload).digest('base64url');}
export function verify(token,kind){
 if(typeof token!=='string'||token.length>18000)throw new AppError('요청 정보가 올바르지 않습니다.',400);
 const [payload,signature,...extra]=token.split('.'),expected=createHmac('sha256',secret()).update(payload||'').digest('base64url');const a=Buffer.from(signature||''),b=Buffer.from(expected);
 if(extra.length||a.length!==b.length||!timingSafeEqual(a,b))throw new AppError('요청 정보가 올바르지 않습니다.',400);
 let value;try{value=JSON.parse(Buffer.from(payload,'base64url').toString());}catch{throw new AppError('요청 정보를 읽을 수 없습니다.',400);}
 if(value.kind!==kind||value.expires<Date.now())throw new AppError('조회 정보가 만료됐어요. 다시 검색해 주세요.',410);return value.data;
}
export const fieldMask='id,displayName,formattedAddress,rating,userRatingCount,googleMapsUri,businessStatus,attributions,location,photos,priceLevel,currentOpeningHours';
export function placeView(p){
 const lat=p.location?.latitude,lng=p.location?.longitude;
 const photo=p.photos?.find(x=>typeof x.name==='string'&&/^places\/[\w-]+\/photos\/[\w-]+$/.test(x.name));
 return {id:p.id,name:p.displayName?.text||'이름 미제공',address:p.formattedAddress||'',rating:p.rating??null,reviews:p.userRatingCount??0,mapsUrl:safeURL(p.googleMapsUri),location:Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null,openNow:typeof p.currentOpeningHours?.openNow==='boolean'?p.currentOpeningHours.openNow:null,priceLevel:p.priceLevel||null,attributions:p.attributions||[],photo:photo?{token:sign('photo',{name:photo.name}),authors:(photo.authorAttributions||[]).map(a=>({name:a.displayName||'사진 제공자',url:safeURL(a.uri?.startsWith('//')?'https:'+a.uri:a.uri)}))}:null};
}
export function parseIds(value){if(!Array.isArray(value)||value.length>20||value.some(x=>typeof x!=='string'||!/^[-\w]{1,200}$/.test(x)))throw new AppError('저장한 식당 정보를 확인해 주세요.',400);return [...new Set(value)];}
export async function detail(id){return fetchJSON(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`,{headers:{'X-Goog-Api-Key':process.env.GOOGLE_MAPS_API_KEY,'X-Goog-FieldMask':fieldMask}},10000);}
