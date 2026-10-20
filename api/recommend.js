import {AppError,aiDiagnostic,aiFailureMessage} from '../lib/core.js';
import {authorize,failure,verify} from '../lib/http.js';
import {rankPlaces} from '../lib/pipeline.js';
export default async function handler(req,res){try{
 authorize(req,res);if(!process.env.GEMINI_API_KEY)throw new AppError('AI 기능이 설정되지 않았습니다.',503);
 const {q,places}=verify(req.body?.token,'recommend');const ranked=await rankPlaces(q,places,AbortSignal.timeout(20000));
 res.status(200).json({recommendations:ranked.filter(p=>p.aiRecommended).map(({id,reason})=>({id,reason}))});
}catch(e){console.warn('ai_ranking',aiDiagnostic(e));failure(res,e instanceof AppError?new AppError(aiFailureMessage(e),e.status):e);}}
