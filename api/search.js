import {timingSafeEqual} from 'node:crypto';
import {AppError,input} from '../lib/core.js';
import {runSearch} from '../lib/pipeline.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, no-transform');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'POST 요청만 지원합니다.'});}
 try{
  if(Number(req.headers['content-length']||0)>6000)throw new AppError('요청이 너무 큽니다.',413);
  if(process.env.APP_PASSWORD){const a=Buffer.from(String(req.headers['x-app-password']||'')),b=Buffer.from(process.env.APP_PASSWORD);if(a.length!==b.length||!timingSafeEqual(a,b))throw new AppError('사이트 비밀번호를 확인해 주세요.',401);}
  const q=input(req.body);
  if(!process.env.GOOGLE_MAPS_API_KEY||!process.env.GEMINI_API_KEY)throw new AppError('Vercel 환경변수에 두 API 키를 설정해 주세요.',503);
  res.setHeader('Content-Type','application/x-ndjson; charset=utf-8');res.setHeader('X-Accel-Buffering','no');res.flushHeaders?.();
  const controller=new AbortController();let done=false;
  const emit=data=>{if(!res.destroyed&&!res.writableEnded)res.write(JSON.stringify(data)+'\n');};
  const onClose=()=>{if(!done)controller.abort();};res.on('close',onClose);
  const timer=setTimeout(()=>controller.abort(),65000);const heartbeat=setInterval(()=>emit({type:'heartbeat'}),5000);
  try{await runSearch(q,emit,controller.signal);}catch(e){if(!controller.signal.aborted)emit({type:'error',message:e instanceof AppError?e.message:'검색을 완료하지 못했어요. 다시 시도해 주세요.'});}
  finally{if(controller.signal.aborted&&!res.destroyed)emit({type:'error',message:'분석 제한 시간에 도달했어요. 표시된 식당은 계속 확인할 수 있어요.'});done=true;clearTimeout(timer);clearInterval(heartbeat);res.off('close',onClose);res.end();}
 }catch(e){return res.status(e.status||502).json({error:e instanceof AppError?e.message:'검색 요청을 처리하지 못했어요.'});}
}
