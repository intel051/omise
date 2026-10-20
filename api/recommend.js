import {AppError,aiDiagnostic,aiFailureMessage} from '../lib/core.js';
import {authorize,failure,verify} from '../lib/http.js';
import {recommendWithRetry} from '../lib/pipeline.js';
export default async function handler(req,res){
 const disconnected=new AbortController();const onClose=()=>disconnected.abort();
 try{
  authorize(req,res);if(!process.env.GEMINI_API_KEY)throw new AppError('AI 기능이 설정되지 않았습니다.',503);
  const {q,places}=verify(req.body?.token,'recommend');res.on?.('close',onClose);
  const signal=AbortSignal.any([disconnected.signal,AbortSignal.timeout(48000)]);
  const {ranked,partial,retried}=await recommendWithRetry(q,places,signal);
  if(!disconnected.signal.aborted)res.status(200).json({recommendations:ranked.filter(p=>p.aiRecommended).map(({id,reason})=>({id,reason})),partial,retried});
 }catch(e){
  if(disconnected.signal.aborted)return;
  console.warn('ai_ranking',aiDiagnostic(e));
  failure(res,new AppError(aiFailureMessage(e),e?.name==='TimeoutError'?504:e.status||502));
 }finally{res.off?.('close',onClose);}
}
