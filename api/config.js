export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET 요청만 지원합니다.'});}
 // This is an intentionally public, referrer-restricted browser key; never the server key.
 res.status(200).json({mapsBrowserKey:process.env.GOOGLE_MAPS_BROWSER_KEY||'',mapsMapId:process.env.GOOGLE_MAPS_MAP_ID||'',aiEnabled:Boolean(process.env.GEMINI_API_KEY)});
}
