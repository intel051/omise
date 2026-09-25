import {readEvents} from './stream.js';
const $=s=>document.querySelector(s),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function link(text,url){try{if(new URL(url).protocol!=='https:')return node('span',text);}catch{return node('span',text);}const a=node('a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
let controller=null,restaurants=[],elements=new Map();
document.querySelectorAll('[data-city]').forEach(b=>b.onclick=()=>{$('#city').value=b.dataset.city;$('#food').focus();});
function makeCard(p,i){
 const c=node('article',undefined,'card');c.style.setProperty('--i',i);c.dataset.id=p.id;
 const g=node('div',undefined,'google-block'),top=node('div',undefined,'card-top'),content=node('div');content.append(node('h3',p.name),node('p',p.address,'address'));top.append(node('span',String(i+1).padStart(2,'0'),'rank'),content);g.append(top);
 const ratings=node('div',undefined,'ratings'),attr=node('span','Google Maps','gmp');attr.setAttribute('translate','no');ratings.append(node('strong',p.rating==null?'—':`★ ${Number(p.rating).toFixed(1)}`),node('span',`리뷰 ${Number(p.reviews).toLocaleString()}개`),attr);g.append(ratings);
 for(const a of p.attributions||[]){const el=node('div',undefined,'attribution');el.append(link(a.provider||'데이터 제공자',a.providerUri));g.append(el);}c.append(g,node('div',undefined,'detail-slot'),node('p',p.reason,'reason'));updateDetail(c,p);return c;
}
function updateDetail(c,p){
 const slot=c.querySelector('.detail-slot');slot.replaceChildren();const line=node('div',undefined,'tabelog-line');line.append(node('span','食べログ · 타베로그','tabelog-title'));
 const labels={pending:'확인 중',skipped:'이번 검색 미조회',unknown:'미확인',found:'페이지 읽기 완료'};
 if(p.tabelog)line.append(node('strong',p.tabelog.score.toFixed(2),'score'));
 line.append(node('span',labels[p.checkStatus]||'미확인',`badge ${p.checkStatus}`));slot.append(line);
 if(p.message||p.tabelog)slot.append(node('p',p.tabelog?`${p.tabelog.label} · 조회 ${new Date(p.tabelog.checkedAt).toLocaleTimeString('ko-KR')}`:p.message,'detail-note'));
 const links=node('div',undefined,'links');if(p.mapsUrl)links.append(link('Google 지도 ↗',p.mapsUrl));links.append(link(p.tabelog?'타베로그 원문 ↗':'타베로그 검색 ↗',p.tabelog?.url||`https://www.google.com/search?q=${encodeURIComponent(`site:tabelog.com ${p.name} ${p.address}`)}`));slot.append(links);c.classList.remove('updated');void c.offsetWidth;c.classList.add('updated');
}
function showPlaces(items){restaurants=items;elements=new Map();$('#cards').replaceChildren();items.forEach((p,i)=>{const c=makeCard(p,i);elements.set(p.id,c);$('#cards').append(c);});$('#count').textContent=`${items.length} PLACES`;if(!items.length)$('#cards').append(node('div','검색 결과가 없어요. 동네나 메뉴를 바꿔보세요.','empty small'));}
function stage(name){const stages=['search','details','ranking'];document.querySelectorAll('[data-step]').forEach(el=>{el.classList.toggle('active',el.dataset.step===name);el.classList.toggle('completed',name==='done'||stages.indexOf(el.dataset.step)<stages.indexOf(name));});}
function finishPending(message){for(const p of restaurants)if(p.checkStatus==='pending'){p.checkStatus='unknown';p.message=message;updateDetail(elements.get(p.id),p);}}
function addSources(event){if(!event.sources?.length&&!event.suggestions)return;const d=node('details',undefined,'sources'),p=restaurants.find(p=>p.id===event.id);d.append(node('summary',`${p?.name||'식당'} · 검색 출처`));const ul=node('ul');for(const s of event.sources||[])if(s.url){const li=node('li');li.append(link(s.title,s.url));ul.append(li);}d.append(ul);if(event.suggestions){const f=node('iframe');f.title='Google 검색 제안';f.setAttribute('sandbox','allow-popups allow-popups-to-escape-sandbox');f.srcdoc=event.suggestions;d.append(f);}$('#sources').append(d);}
$('#cancel').onclick=()=>controller?.abort();
$('#search').addEventListener('submit',async e=>{
 e.preventDefault();if(controller)return;controller=new AbortController();const current=controller;let completed=false,serverError=false;const started=performance.now();
 restaurants=[];elements.clear();$('#submit').disabled=true;$('#cancel').hidden=false;$('#progress').hidden=false;$('#status').className='';$('#status').textContent='동네에서 식당을 찾고 있어요…';$('#result-title').textContent='새로운 한 끼를 찾는 중';$('#count').textContent='SEARCHING';stage('search');
 for(const id of ['cards','warnings','sources'])$('#'+id).replaceChildren();for(let i=0;i<3;i++){const n=node('div',undefined,'skeleton');n.setAttribute('aria-hidden','true');$('#cards').append(n);}
 const tick=()=>$('#elapsed').textContent=`${Math.floor((performance.now()-started)/1000)}초`;tick();const timer=setInterval(tick,1000);const deadline=setTimeout(()=>current.abort('timeout'),75000);
 try{
  const response=await fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json','x-app-password':$('#password').value},body:JSON.stringify(Object.fromEntries(new FormData(e.target))),signal:current.signal});
  if(!response.ok){const data=await response.json();throw Error(data.error||'검색 요청에 실패했어요.');}
  await readEvents(response.body,event=>{
   if(event.type==='places'){showPlaces(event.restaurants);$('#result-title').textContent='먼저 발견한 식당';stage('details');$('#status').textContent=`목록 도착 · 첫 ${event.checkedCount}곳의 타베로그 페이지를 동시에 확인하고 있어요.`;}
   else if(event.type==='detail'){const i=restaurants.findIndex(p=>p.id===event.restaurant.id);if(i>=0){restaurants[i]=event.restaurant;updateDetail(elements.get(event.restaurant.id),event.restaurant);}const n=restaurants.filter(p=>['found','unknown'].includes(p.checkStatus)).length;$('#status').textContent=`타베로그 확인 ${n}/${Math.min(3,restaurants.length)} · 식당 링크는 지금 열어볼 수 있어요.`;}
   else if(event.type==='sources')addSources(event);
   else if(event.type==='stage'){stage('ranking');$('#status').textContent='확인된 정보를 바탕으로 추천을 정리하고 있어요…';}
   else if(event.type==='warning')$('#warnings').append(node('div',event.message,'notice'));
   else if(event.type==='error'){serverError=true;throw Error(event.message);}
   else if(event.type==='done'){
    completed=true;restaurants=event.restaurants;const render=()=>{restaurants.forEach((p,i)=>{const c=elements.get(p.id);if(!c)return;c.querySelector('.rank').textContent=String(i+1).padStart(2,'0');c.querySelector('.reason').textContent=p.reason;$('#cards').append(c);});};
    if(document.startViewTransition&&!reduced.matches&&restaurants.length)document.startViewTransition(render);else render();
    stage('done');$('#result-title').textContent=event.aiRanked?'취향을 참고해 고른 한 끼':'발견한 식당';$('#status').textContent='검색 완료 · 점수 조회 시각은 원문 갱신 시각과 다를 수 있어요.';
   }
  });if(!completed&&!serverError)throw Error('연결이 끊어졌어요. 표시된 식당은 계속 확인할 수 있어요.');
 }catch(err){finishPending('분석이 끝나지 않아 미확인으로 표시해요.');$('#status').className='error';$('#status').textContent=current.signal.aborted?(current.signal.reason==='timeout'?'응답 시간이 초과됐어요.':'분석을 중단했어요. 표시된 식당은 계속 확인할 수 있어요.'):err.message;if(!restaurants.length){$('#cards').replaceChildren(node('div','조건을 확인하고 다시 검색해 주세요.','empty small'));$('#count').textContent='0 PLACES';}$('#result-title').textContent=restaurants.length?'발견한 식당':'검색을 완료하지 못했어요.';}
 finally{if(!completed)current.abort();clearInterval(timer);clearTimeout(deadline);tick();$('#submit').disabled=false;$('#cancel').hidden=true;controller=null;document.querySelectorAll('[data-step]').forEach(el=>el.classList.remove('active'));}
});
