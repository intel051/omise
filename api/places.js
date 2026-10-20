import {authorize,failure,requireMaps,parseIds,detail,placeView} from '../lib/http.js';
export default async function handler(req,res){try{
 authorize(req,res);requireMaps();const ids=parseIds(req.body?.ids),places=[],failedIds=[];
 // Re-fetch current Places content instead of persisting photos or ratings.
 for(let i=0;i<ids.length;i+=5){const batch=ids.slice(i,i+5),values=await Promise.allSettled(batch.map(detail));values.forEach((v,j)=>{if(v.status==='fulfilled')places.push(placeView(v.value));else failedIds.push(batch[j]);});}
 res.status(200).json({places,failedIds});
}catch(e){failure(res,e);}}
