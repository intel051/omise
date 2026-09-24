const $=s=>document.querySelector(s);
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function link(text,url){try{if(new URL(url).protocol!=='https:')return node('span',text);}catch{return node('span',text);}const a=node('a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
document.querySelectorAll('[data-city]').forEach(b=>b.onclick=()=>{$('#city').value=b.dataset.city;$('#food').focus();});
function card(p,i){
  const c=node('article',undefined,'card'),g=node('div',undefined,'google-block'),top=node('div',undefined,'card-top'),content=node('div');
  content.append(node('h3',p.name),node('p',p.address,'address'));top.append(node('span',String(i+1).padStart(2,'0'),'rank'),content);g.append(top);
  const ratings=node('div',undefined,'ratings'),attr=node('span','Google Maps','gmp');attr.translate=false;
  ratings.append(node('strong',p.rating===null?'—':`★ ${p.rating.toFixed(1)}`),node('span',`리뷰 ${p.reviews.toLocaleString()}개`),attr);g.append(ratings);
  for(const a of p.attributions||[]){const el=node('div',undefined,'attribution');el.append(link(a.provider||'데이터 제공자',a.providerUri));g.append(el);}c.append(g);
  const t=node('div',undefined,'tabelog');t.append(node('span','타베로그 '),node('strong',p.tabelog?p.tabelog.score.toFixed(2):'미확인'));c.append(t);
  if(p.tabelog){c.append(node('div',p.tabelog.label,'hint'));const d=node('details'),summary=node('summary','검색 근거 보기');d.append(summary,node('p',p.tabelog.evidence));c.append(d);}
  c.append(node('p',p.reason,'reason'));const links=node('div',undefined,'links');if(p.mapsUrl)links.append(link('Google 지도에서 보기 ↗',p.mapsUrl));if(p.tabelog)links.append(link('타베로그 원문 ↗',p.tabelog.url));else links.append(link('타베로그 검색 ↗',`https://www.google.com/search?q=${encodeURIComponent(`site:tabelog.com ${p.name} ${p.address}`)}`));c.append(links);return c;
}
$('#search').addEventListener('submit',async e=>{
  e.preventDefault();$('#submit').disabled=true;$('#status').className='';$('#status').textContent='식당을 검색하고 타베로그 근거를 살펴보고 있어요…';
  for(const id of ['cards','warnings','sources','suggestions'])$('#'+id).replaceChildren();$('#count').textContent='';
  try{
    const response=await fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json','x-app-password':$('#password').value},body:JSON.stringify(Object.fromEntries(new FormData(e.target))),signal:AbortSignal.timeout(115000)});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'검색하지 못했습니다.');
    $('#result-title').textContent=data.aiRanked?'취향을 참고해 고른 식당':'Google 검색 결과';$('#count').textContent=`${data.restaurants.length}곳`;
    data.restaurants.forEach((p,i)=>$('#cards').append(card(p,i)));
    if(!data.restaurants.length)$('#cards').append(node('div','검색 결과가 없어요. 동네나 메뉴를 바꿔보세요.','empty'));
    for(const w of data.warnings||[])$('#warnings').append(node('div',w,'notice'));
    $('#status').textContent=`검색 완료 · ${new Date(data.checkedAt).toLocaleString('ko-KR')} (검색 시각이며 별점 갱신 시각은 아닙니다.)`;
    if(data.sources?.length){const d=node('details',undefined,'sources');d.append(node('summary','AI가 참고한 검색 출처'));const ul=node('ul');data.sources.forEach((s,i)=>{if(s.url){const li=node('li');li.append(link(`[${i+1}] ${s.title}`,s.url));ul.append(li);}});d.append(ul);$('#sources').append(d);}
    if(data.suggestions){const frame=node('iframe');frame.title='Google 검색 제안';frame.setAttribute('sandbox','allow-popups allow-popups-to-escape-sandbox');frame.srcdoc=data.suggestions;$('#suggestions').append(frame);}
  }catch(err){$('#status').className='error';$('#status').textContent=err.name==='TimeoutError'?'검색 시간이 초과됐어요. 다시 시도해 주세요.':err.message;$('#result-title').textContent='검색을 완료하지 못했어요.';}
  finally{$('#submit').disabled=false;}
});
