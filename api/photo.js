import {AppError,fetchJSON} from '../lib/core.js';
import {authorize,failure,requireMaps,verify} from '../lib/http.js';
export default async function handler(req,res){try{
 authorize(req,res);requireMaps();const {name}=verify(req.body?.token,'photo');
 if(!/^places\/[\w-]+\/photos\/[\w-]+$/.test(name))throw new AppError('사진 정보를 확인해 주세요.',400);
 const r=await fetchJSON(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=720&skipHttpRedirect=true`,{headers:{'X-Goog-Api-Key':process.env.GOOGLE_MAPS_API_KEY}},10000);
 let u;try{u=new URL(r.photoUri);}catch{throw new AppError('사진이 제공되지 않습니다.',404);}
 if(u.protocol!=='https:'||!/(^|\.)googleusercontent\.com$/.test(u.hostname))throw new AppError('사진 주소를 확인하지 못했습니다.',502);
 res.status(200).json({url:u.href});
}catch(e){failure(res,e);}}
