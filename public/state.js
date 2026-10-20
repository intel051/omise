export const STORE_KEY='hitokuchi.trips.v1';
const uid=()=>globalThis.crypto?.randomUUID?.()||`id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const text=(v,max)=>typeof v==='string'?v.slice(0,max):'';
export function initialState(){return {version:1,trips:[{id:'default',name:'다음 일본 여행'}],bookmarks:[],selectedTrip:'default'};}
export function cleanState(raw){
 if(!raw||raw.version!==1||!Array.isArray(raw.trips)||!Array.isArray(raw.bookmarks))throw Error('저장 형식이 올바르지 않습니다.');
 const trips=raw.trips.filter(t=>typeof t?.id==='string'&&t.id.length<=100&&text(t.name,40).trim()).slice(0,40).map(t=>({id:t.id,name:text(t.name,40).trim()}));
 if(!trips.length)throw Error('여행 정보가 없습니다.');
 const tripIds=new Set(trips.map(t=>t.id)),seen=new Set(),bookmarks=[];
 for(const b of raw.bookmarks){if(!tripIds.has(b?.tripId)||typeof b.placeId!=='string'||!/^[-\w]{1,200}$/.test(b.placeId))continue;const key=b.tripId+':'+b.placeId;if(seen.has(key))continue;seen.add(key);bookmarks.push({id:text(b.id,100)||uid(),placeId:b.placeId,tripId:b.tripId,note:text(b.note,500),createdAt:Number.isFinite(b.createdAt)?b.createdAt:Date.now(),visitedAt:Number.isFinite(b.visitedAt)?b.visitedAt:null});if(bookmarks.length>=300)break;}
 return {version:1,trips,bookmarks,selectedTrip:tripIds.has(raw.selectedTrip)?raw.selectedTrip:trips[0].id};
}
export function loadState(storage){try{const raw=storage.getItem(STORE_KEY);return {state:raw?cleanState(JSON.parse(raw)):initialState(),error:null};}catch{return {state:initialState(),error:'저장 정보를 읽지 못했어요. 브라우저 저장공간을 확인해 주세요.'};}}
export function saveState(storage,state){storage.setItem(STORE_KEY,JSON.stringify(cleanState(state)));}
export function addTrip(state,name){const trimmed=text(name,40).trim();if(!trimmed)throw Error('여행 이름을 입력해 주세요.');if(state.trips.length>=40)throw Error('여행은 최대 40개까지 만들 수 있어요.');if(state.trips.some(t=>t.name===trimmed))throw Error('같은 이름의 여행이 있어요.');const t={id:uid(),name:trimmed};return {...state,trips:[...state.trips,t],selectedTrip:t.id};}
export function toggleBookmark(state,placeId){const existing=state.bookmarks.find(b=>b.tripId===state.selectedTrip&&b.placeId===placeId);if(existing)return {...state,bookmarks:state.bookmarks.filter(b=>b.id!==existing.id)};if(state.bookmarks.length>=300)throw Error('식당은 최대 300곳까지 저장할 수 있어요.');return {...state,bookmarks:[...state.bookmarks,{id:uid(),placeId,tripId:state.selectedTrip,note:'',createdAt:Date.now(),visitedAt:null}]};}
export function updateBookmark(state,id,patch){return {...state,bookmarks:state.bookmarks.map(b=>b.id===id?{...b,...patch,id:b.id,tripId:b.tripId,placeId:b.placeId}:b)};}
export function directionsURL(p){const u=new URL('https://www.google.com/maps/dir/');u.searchParams.set('api','1');u.searchParams.set('destination',p.name||p.id);u.searchParams.set('destination_place_id',p.id);u.searchParams.set('travelmode','walking');return u.href;}
