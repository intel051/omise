let libraryPromise;
function libraries(key){
 if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{
  if(window.google?.maps?.importLibrary)return resolve(window.google.maps);
  const callback='__omiseMapsReady';const script=document.createElement('script');let timer;
  const fail=()=>{clearTimeout(timer);delete window[callback];script.remove();libraryPromise=null;reject(Error('지도를 불러오지 못했어요.'));};
  window[callback]=()=>{clearTimeout(timer);delete window[callback];resolve(window.google.maps);};
  window.gm_authFailure=()=>{window.dispatchEvent(new Event('omise-map-error'));fail();};
  const u=new URL('https://maps.googleapis.com/maps/api/js');u.searchParams.set('key',key);u.searchParams.set('v','weekly');u.searchParams.set('loading','async');u.searchParams.set('callback',callback);u.searchParams.set('language','ko');
  script.src=u.href;script.async=true;script.onerror=fail;timer=setTimeout(fail,15000);document.head.append(script);
 });return libraryPromise;
}
export class DiningMap{
 constructor(canvas,onSelect){this.canvas=canvas;this.onSelect=onSelect;this.markers=[];this.map=null;this.pending=[];this.selected=null;}
 async initialize(config){
  if(!config.mapsBrowserKey)throw Error('지도를 사용할 수 없어요. 식당 카드의 길찾기를 이용해 주세요.');
  const maps=await libraries(config.mapsBrowserKey);const [{Map},{AdvancedMarkerElement}]=await Promise.all([maps.importLibrary('maps'),maps.importLibrary('marker')]);
  this.Marker=AdvancedMarkerElement;this.map=new Map(this.canvas,{center:{lat:35.681,lng:139.767},zoom:12,mapId:config.mapsMapId||'DEMO_MAP_ID',disableDefaultUI:true,zoomControl:true,gestureHandling:'cooperative',clickableIcons:false});this.render(this.pending,this.selected);
 }
 render(places,selected){
  this.pending=places;this.selected=selected;if(!this.map)return;
  this.markers.forEach(m=>m.marker.map=null);this.markers=[];
  const bounds=new window.google.maps.LatLngBounds();
  places.forEach((p,i)=>{if(!p.location)return;const el=document.createElement('button');el.type='button';el.className='map-pin'+(p.id===selected?' selected':'');const label=document.createElement('span');label.textContent=String(i+1);el.append(label);el.setAttribute('aria-label',p.name);const marker=new this.Marker({map:this.map,position:p.location,title:p.name,content:el});el.onclick=()=>this.onSelect(p.id);this.markers.push({marker,el,id:p.id});bounds.extend(p.location);});
  if(this.markers.length===1){this.map.setCenter(places.find(p=>p.location).location);this.map.setZoom(15);}else if(this.markers.length)this.map.fitBounds(bounds,55);
 }
 focus(p){this.selected=p?.id||null;if(!this.map||!p?.location)return;this.map.panTo(p.location);if(this.map.getZoom()<14)this.map.setZoom(14);this.markers.forEach(m=>m.el.classList.toggle('selected',m.id===p.id));}
}
