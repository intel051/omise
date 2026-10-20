import {tabelogURL,validateRestaurant} from './core.js';
const agent='OmiseRestaurantLookup/1.0 (+https://github.com/intel051/omise)';
let robotsCache;
export function robotsAllows(text,path,ua=agent){
 const groups=[];let current={agents:[],rules:[]},hasRules=false;
 for(const raw of text.split(/\r?\n/)){
  const line=raw.replace(/#.*/,'').trim(),m=line.match(/^([^:]+):\s*(.*)$/);if(!m)continue;
  const key=m[1].toLowerCase(),value=m[2].trim();
  if(key==='user-agent'){if(hasRules){groups.push(current);current={agents:[],rules:[]};hasRules=false;}current.agents.push(value.toLowerCase());}
  else if(['allow','disallow'].includes(key)&&current.agents.length){current.rules.push({allow:key==='allow',path:value});hasRules=true;}
 }
 if(current.agents.length)groups.push(current);
 const specificity=g=>Math.max(-1,...g.agents.map(a=>a==='*'?0:(ua.toLowerCase().includes(a)?a.length:-1)));
 const best=Math.max(-1,...groups.map(specificity));let winner=null;
 for(const group of groups.filter(g=>specificity(g)===best))for(const rule of group.rules){
  if(!rule.path)continue;
  const pattern=rule.path.split('*').map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*').replace(/\\\$$/,'$');
  if(new RegExp('^'+pattern).test(path)&&(!winner||rule.path.length>winner.path.length||(rule.path.length===winner.path.length&&rule.allow)))winner=rule;
 }
 return winner?.allow??true;
}
async function readLimited(response,limit){
 if(Number(response.headers.get('content-length')||0)>limit){await response.body?.cancel();throw Error('response_too_large');}
 const reader=response.body?.getReader();if(!reader)throw Error('empty_response');let size=0,text='',decoder=new TextDecoder();
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw Error('response_too_large');text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
async function robots(){
 if(robotsCache&&robotsCache.expires>Date.now())return robotsCache.promise;
 const promise=(async()=>{
  const r=await fetch('https://tabelog.com/robots.txt',{headers:{'User-Agent':agent},redirect:'error',signal:AbortSignal.timeout(3000)});
  if(r.status===404){await r.body?.cancel();return '';}
  if(!r.ok){await r.body?.cancel();throw Error('robots_unavailable');}
  return readLimited(r,128000);
 })();
 robotsCache={expires:Date.now()+600000,promise};
 try{return await promise;}catch(e){robotsCache=undefined;throw e;}
}
const types=node=>[].concat(node?.['@type']||[]).map(t=>String(t).split(/[\/#]/).at(-1));
export function parseRestaurantHTML(html,place,url){
 const rows=[];
 const visit=node=>{
  if(Array.isArray(node)){node.forEach(visit);return;}if(!node||typeof node!=='object')return;
  if(node['@graph'])visit(node['@graph']);if(node.mainEntity)visit(node.mainEntity);
  if(!types(node).some(t=>['Restaurant','FoodEstablishment','LocalBusiness'].includes(t)))return;
  const rating=node.aggregateRating;if(!rating||typeof rating!=='object')return;
  const best=Number(rating.bestRating??5);if(best!==5)return;
  const score=typeof rating.ratingValue==='number'?rating.ratingValue:Number(String(rating.ratingValue||'').trim());
  if(!Number.isFinite(score)||score<1||score>5)return;
  const source=node.url||node['@id'];if(typeof source==='string'&&source.startsWith('http')&&tabelogURL(source)!==url)return;
  const a=node.address;const address=typeof a==='string'?a:a&&[a.addressRegion,a.addressLocality,a.streetAddress].filter(Boolean).join('');
  const matched=validateRestaurant(place,{name:node.name,address,score,url,branchMatch:true},url);
  if(matched)rows.push({...matched,method:'html',label:'공개 HTML에서 확인 · 원문 재확인 필요'});
 };
 for(const match of html.matchAll(/<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)){
  try{visit(JSON.parse(match[1]));}catch{/* Ignore invalid scripts, never execute HTML. */}
 }
 if(!rows.length||new Set(rows.map(r=>r.score)).size!==1)return null;
 return rows[0];
}
export async function crawlTabelog(place,value,signal){
 const url=tabelogURL(value);if(!url)return {status:'invalid_url',tabelog:null};
 try{
  if(signal?.aborted)throw signal.reason;
  if(!robotsAllows(await robots(),new URL(url).pathname))return {status:'robots_disallowed',tabelog:null};
  const requestSignal=signal?AbortSignal.any([signal,AbortSignal.timeout(6500)]):AbortSignal.timeout(6500);
  const r=await fetch(url,{headers:{'User-Agent':agent,Accept:'text/html'},redirect:'manual',signal:requestSignal});
  // Do not follow login/challenge redirects, retry blocked requests or impersonate browsers.
  if(!r.ok){await r.body?.cancel();return {status:[401,403,429].includes(r.status)?'access_blocked':`http_${r.status}`,tabelog:null};}
  if(!r.headers.get('content-type')?.includes('text/html')){await r.body?.cancel();return {status:'not_html',tabelog:null};}
  const tabelog=parseRestaurantHTML(await readLimited(r,2500000),place,url);
  return {status:tabelog?'found':'no_matching_structured_rating',tabelog};
 }catch(e){return {status:e?.name==='TimeoutError'?'timeout':e?.name==='AbortError'?'cancelled':e?.message==='robots_unavailable'?'robots_unavailable':'fetch_failed',tabelog:null};}
}
