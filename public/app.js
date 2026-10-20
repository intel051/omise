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
 for(const a of p.attributions||[]){const el=node('div',undefined,'attribution');el.append(link(a.provider||'데이터 제공자',a.providerUri));g.append(el);}const links=node('div',undefined,'links');if(p.mapsUrl)links.append(link('Google 지도에서 보기 ↗',p.mapsUrl));c.append(g,node('div',undefined,'recommendation'),links);updateRecommendation(c,p);return c;
}
function updateRecommendation(c,p,pending=false){
 const slot=c.querySelector('.recommendation');slot.replaceChildren();
 slot.append(node('p',p.aiRecommended?'AI 추천 이유':pending?'AI 추천을 준비하고 있어요':'검색 결과','reason-label'));
 slot.append(node('p',pending?'구글 별점·리뷰 수와 입력한 취향을 함께 살펴보고 있어요.':p.reason,'reason'));
 if(p.aiRecommended)c.classList.add('updated');
}
function showPlaces(items){restaurants=items;elements=new Map();$('#cards').replaceChildren();items.forEach((p,i)=>{const c=makeCard(p,i);elements.set(p.id,c);$('#cards').append(c);});$('#count').textContent=`${items.length} PLACES`;if(!items.length)$('#cards').append(node('div','검색 결과가 없어요. 동네나 메뉴를 바꿔보세요.','empty small'));}
function stage(name){const stages=['search','ranking'];document.querySelectorAll('[data-step]').forEach(el=>{el.classList.toggle('active',el.dataset.step===name);el.classList.toggle('completed',name==='done'||stages.indexOf(el.dataset.step)<stages.indexOf(name));});}
$('#cancel').onclick=()=>controller?.abort();
$('#search').addEventListener('submit',async e=>{
 e.preventDefault();if(controller)return;controller=new AbortController();const current=controller;let completed=false,serverError=false;const started=performance.now();
 restaurants=[];elements.clear();$('#submit').disabled=true;$('#cancel').hidden=false;$('#progress').hidden=false;$('#status').className='';$('#status').textContent='동네에서 식당을 찾고 있어요…';$('#result-title').textContent='새로운 한 끼를 찾는 중';$('#count').textContent='SEARCHING';stage('search');
 for(const id of ['cards','warnings'])$('#'+id).replaceChildren();for(let i=0;i<3;i++){const n=node('div',undefined,'skeleton');n.setAttribute('aria-hidden','true');$('#cards').append(n);}
 const tick=()=>$('#elapsed').textContent=`${Math.floor((performance.now()-started)/1000)}초`;tick();const timer=setInterval(tick,1000);const deadline=setTimeout(()=>current.abort('timeout'),45000);
 try{
  const response=await fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json','x-app-password':$('#password').value},body:JSON.stringify(Object.fromEntries(new FormData(e.target))),signal:current.signal});
  if(!response.ok){const data=await response.json();throw Error(data.error||'검색 요청에 실패했어요.');}
  await readEvents(response.body,event=>{
   if(event.type==='places'){showPlaces(event.restaurants);$('#result-title').textContent='먼저 발견한 식당';stage('ranking');$('#status').textContent='식당을 찾았어요. AI가 추천 순서와 이유를 정리하고 있어요…';for(const p of restaurants)updateRecommendation(elements.get(p.id),p,true);}
   else if(event.type==='stage'){stage('ranking');$('#status').textContent='확인된 정보를 바탕으로 추천을 정리하고 있어요…';}
   else if(event.type==='warning')$('#warnings').append(node('div',event.message,'notice'));
   else if(event.type==='error'){serverError=true;throw Error(event.message);}
   else if(event.type==='done'){
    completed=true;restaurants=event.restaurants;const render=()=>{restaurants.forEach((p,i)=>{const c=elements.get(p.id);if(!c)return;c.querySelector('.rank').textContent=String(i+1).padStart(2,'0');updateRecommendation(c,p);c.querySelector('.rank').setAttribute('aria-label',`${event.aiRanked?'추천':'검색'} 순서 ${i+1}`);$('#cards').append(c);});};
    if(document.startViewTransition&&!reduced.matches&&restaurants.length)document.startViewTransition(render);else render();
    stage('done');$('#result-title').textContent=event.aiRanked?'AI 추천 순서':'발견한 식당';$('#status').textContent=event.aiRanked?'취향과 검색 정보를 참고한 AI 추천이에요.':'Google 검색 순서로 표시했어요.';
   }
  });if(!completed&&!serverError)throw Error('연결이 끊어졌어요. 표시된 식당은 계속 확인할 수 있어요.');
 }catch(err){for(const p of restaurants)updateRecommendation(elements.get(p.id),p);$('#status').className='error';$('#status').textContent=current.signal.aborted?(current.signal.reason==='timeout'?'응답 시간이 초과됐어요.':'분석을 중단했어요. 표시된 식당은 계속 확인할 수 있어요.'):err.message;if(!restaurants.length){$('#cards').replaceChildren(node('div','조건을 확인하고 다시 검색해 주세요.','empty small'));$('#count').textContent='0 PLACES';}$('#result-title').textContent=restaurants.length?'발견한 식당':'검색을 완료하지 못했어요.';}
 finally{if(!completed)current.abort();clearInterval(timer);clearTimeout(deadline);tick();$('#submit').disabled=false;$('#cancel').hidden=true;controller=null;document.querySelectorAll('[data-step]').forEach(el=>el.classList.remove('active'));}
});

