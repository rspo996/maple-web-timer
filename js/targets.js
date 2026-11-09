/* ===== 감지 대상 모델 (묶음 1 스펙 3절) + 실행 중 저장소 ===== */
const TARGET_MAX=12;
// 내장 3개: 기존 id를 그대로 써서 내 소리 슬롯 키(sol.pre 등)를 이전 없이 이어간다
const BUILTIN={
  sol:{kind:'buff',name:'솔 야누스',preset:'sol',threshold:0.75},
  booster:{kind:'countdown',name:'부스터',preset:'booster',threshold:0.7},
  rune:{kind:'rune',name:'룬',preset:null,threshold:0.8},
};
// 내장 기본 아이콘 세트. 저장하지 않는 코드 상수. 아이콘 이미지는 preset-data.js
const PRESETS={
  sol:{scales:[1,1.25,1.5], area:f=>({x:Math.round(f.w*0.35),y:0,w:Math.round(f.w*0.65),h:Math.round(f.h*0.3)}), get icons(){ return PRESET_ICONS.sol; }},
  booster:{scales:[0.8,1,1.25,1.5], area:f=>({x:Math.round(f.w*0.2),y:0,w:Math.round(f.w*0.6),h:Math.round(f.h*0.3)}), get icons(){ return PRESET_ICONS.booster; }},
};

/* ----- 저장소 v2: 형식·검사·이전 (순수 함수. 저장소 객체를 인자로 받아 node에서 시험한다) ----- */
const STORE_V1='maple-web-timer-v1', STORE_V2='maple-web-timer-v2', STORE_BROKEN='maple-web-timer-v2-broken';
const ID_RE=/^(sol|booster|rune|u\d+)$/;                  // sys·grp·manual·m<숫자>는 다른 용도로 예약
const GROUP_WINDOWS=[5,10,20];
const defaultGroup=()=>({on:false,windowSec:10});          // 알림 묶기는 기본 꺼짐(사용자 결정)
function newTarget(id,kind,name,extra){
  return Object.assign({id,kind,name,preset:null,enabled:true,threshold:0.75,area:null,tpl:null,frameW:0,frameH:0,p:KINDS[kind].defaults()},extra||{});
}
function builtinTarget(id){ const b=BUILTIN[id]; return newTarget(id,b.kind,b.name,{preset:b.preset,threshold:b.threshold}); }
function defaultStore(){ return {ver:2,seq:0,targets:['sol','booster','rune'].map(builtinTarget),group:defaultGroup()}; }
const validRect=r=>!!r&&['x','y','w','h'].every(k=>Number.isFinite(+r[k]))&&r.w>0&&r.h>0;
// v2를 불러올 때마다 각 대상에 적용: 범위 밖 값은 자르고, 모르는 필드는 보존, 모르는 kind는 지우지 않고 끈다
function normalizeTarget(t){
  const o=Object.assign({},t); o.id=String(o.id);
  const nm=typeof o.name==='string'?o.name.trim().slice(0,12):'';
  o.name=nm||(BUILTIN[o.id]&&BUILTIN[o.id].name)||o.id;
  o.enabled=typeof o.enabled==='boolean'?o.enabled:true;
  const th=+o.threshold; o.threshold=Number.isFinite(th)?Math.min(0.98,Math.max(0.4,th)):(BUILTIN[o.id]?BUILTIN[o.id].threshold:0.75);
  o.preset=PRESETS[o.preset]?o.preset:null;
  o.frameW=Math.max(0,Math.round(+o.frameW)||0); o.frameH=Math.max(0,Math.round(+o.frameH)||0);
  o.area=validRect(o.area)?{x:+o.area.x,y:+o.area.y,w:+o.area.w,h:+o.area.h}:null;
  o.tpl=o.tpl&&typeof o.tpl.url==='string'&&o.tpl.w>0&&o.tpl.h>0?{url:o.tpl.url,w:o.tpl.w,h:o.tpl.h}:null;
  const k=KINDS[o.kind]; if(!k){ o.enabled=false; return o; }
  o.p=k.normalizeP(Object.assign(k.defaults(),o.p&&typeof o.p==='object'?o.p:{}));
  return o;
}
function normalizeStore(raw){
  const seen=new Set(), targets=[]; let maxU=0;
  for(const t of raw.targets){
    if(!t||typeof t!=='object'||!ID_RE.test(String(t.id))||seen.has(String(t.id))) continue;
    const m=/^u(\d+)$/.exec(t.id); if(m) maxU=Math.max(maxU,+m[1]);
    if(targets.length>=TARGET_MAX) continue;
    seen.add(String(t.id)); targets.push(normalizeTarget(t));
  }
  const g=raw.group||{}, seq=Number.isFinite(+raw.seq)?Math.floor(+raw.seq):0;
  return {ver:2,seq:Math.max(seq,maxU),targets,group:{on:g.on===true,windowSec:GROUP_WINDOWS.includes(g.windowSec)?g.windowSec:10}};
}
// 새 대상 id: u + 단조 증가 숫자. 삭제한 id는 다시 쓰지 않으므로 지워진 대상의 내 소리가 새 대상에 붙지 않는다
function makeId(store){ store.seq=(store.seq||0)+1; return 'u'+store.seq; }
// v1(대상 id별 객체) → v2. 스펙 4.2 표
function migrateV1(v1){
  const store=defaultStore();
  if(!v1||typeof v1!=='object'||Array.isArray(v1)) return store;
  const b=v1.booster&&typeof v1.booster==='object'?{...v1.booster}:null;
  if(b&&b.ver!==2) Object.assign(b,{tpl:null,area:null,frameW:0,frameH:0,threshold:0.7});   // 예전 부스터 재설정(ver 2 이전 값은 못 씀)
  const src={sol:v1.sol,booster:b,rune:v1.rune};
  store.targets=store.targets.map(t=>{
    const o=src[t.id]; if(!o||typeof o!=='object') return t;
    const m=Object.assign({},t,{enabled:typeof o.enabled==='boolean'?o.enabled:true,area:o.area||null,tpl:o.tpl||null,frameW:o.frameW,frameH:o.frameH});
    if(Number.isFinite(+o.threshold)&&o.threshold!=null) m.threshold=+o.threshold;
    const p=Object.assign({},t.p);
    if(t.id==='sol'){ p.durationSec=o.durationSec||null; if(o.leadSec!=null) p.leadSec=o.leadSec; }
    if(t.id==='booster'&&o.leadSec!=null) p.leadSec=o.leadSec;
    if(t.id==='rune'&&o.repeatSec!=null) p.repeatSec=o.repeatSec;
    m.p=p; return normalizeTarget(m);
  });
  return store;
}
const browserStorage=()=>{ try{ return typeof localStorage!=='undefined'?localStorage:null; }catch(e){ return null; } };
function saveStore(store,st){ try{ st=st===undefined?browserStorage():st; if(!st) return false; st.setItem(STORE_V2,JSON.stringify(store)); return true; }catch(e){ return false; } }
// status: 'ok'(v2 정상) | 'migrated'(v1에서 이전) | 'fresh'(저장된 것 없음) | 'broken'(v2를 못 읽음). 고아 정리는 ok·migrated일 때만
function loadStore(st){
  st=st===undefined?browserStorage():st;
  const get=k=>{ try{ return st?st.getItem(k):null; }catch(e){ return null; } };
  const parse=raw=>{ try{ return JSON.parse(raw); }catch(e){ return undefined; } };
  const v2raw=get(STORE_V2);
  if(v2raw!=null){
    const v2=parse(v2raw);
    if(v2&&typeof v2==='object'&&v2.ver===2&&Array.isArray(v2.targets)) return {store:normalizeStore(v2),status:'ok',saveFailed:false};
    try{ st.setItem(STORE_BROKEN,v2raw); }catch(e){}
    return {store:defaultStore(),status:'broken',saveFailed:false};      // v1 이전은 하지 않는다
  }
  const v1raw=get(STORE_V1), v1=v1raw!=null?parse(v1raw):undefined;
  if(v1&&typeof v1==='object'&&!Array.isArray(v1)){
    const store=migrateV1(v1); return {store,status:'migrated',saveFailed:!saveStore(store,st)};   // v1 키는 지우지 않는다
  }
  return {store:defaultStore(),status:'fresh',saveFailed:false};
}
function checkName(raw,targets,selfId){
  const name=String(raw==null?'':raw).trim();
  if(name.length<1||name.length>12||targets.some(t=>t.id!==selfId&&t.name===name)) return {ok:false,name,msg:'이름을 1~12자로, 다른 대상과 다르게 입력해 주세요'};
  return {ok:true,name,msg:''};
}
// 상태줄과 묶음 5의 PIP가 같이 쓰는 한 행. ctx={src:boolean, frame:{w,h}}
function targetSnapshot(targets,states,ctx,now){
  return targets.map(t=>{
    const k=KINDS[t.kind], st=states[t.id]||newState();
    if(!k) return {id:t.id,name:t.name,kind:t.kind,enabled:false,stripState:'off',statusText:'이 버전에서 지원하지 않는 종류예요',remainSec:null};
    const s=k.stripState(t,st,now,ctx);
    return {id:t.id,name:t.name,kind:t.kind,enabled:t.enabled,stripState:s,stripText:k.stripText?k.stripText(t,st,s):null,statusText:cardStatus(t,st,now,ctx).text,remainSec:k.remainSec(t,st,now)};
  });
}

/* ----- 대상 추가 (순수: 저장소 객체를 바꾸고 결과를 돌려준다. 화면 처리는 ui-cards.js) ----- */
const FULL_MSG=`대상은 ${TARGET_MAX}개까지 둘 수 있어요`;
function missingBuiltins(targets){ return Object.keys(BUILTIN).filter(id=>!targets.some(t=>t.id===id)); }
// 지웠던 내장 대상을 기본값으로 다시 만든다(원래 id). 같은 이름이 이미 있으면 (기본)을 붙인다
function addBuiltin(store,id){
  if(!BUILTIN[id]||store.targets.some(t=>t.id===id)) return {ok:false,msg:'이미 목록에 있어요'};
  if(store.targets.length>=TARGET_MAX) return {ok:false,msg:FULL_MSG};
  const t=builtinTarget(id); let name=t.name, n=1;
  while(store.targets.some(x=>x.name===name)){ name=`${t.name} (기본${n>1?' '+n:''})`; n++; }
  t.name=name; store.targets.push(t); return {ok:true,target:t};
}
// 이름만 채운 새 버프. 지속시간·아이콘은 비워 둔다(게임 안 값을 모르므로 미리 채우지 않음)
function addBuff(store,rawName){
  if(store.targets.length>=TARGET_MAX) return {ok:false,msg:FULL_MSG};
  const c=checkName(rawName,store.targets,null); if(!c.ok) return {ok:false,msg:c.msg};
  const t=newTarget(makeId(store),'buff',c.name,{threshold:0.75}); store.targets.push(t); return {ok:true,target:t};
}

// 종류로 새 대상(사냥 멈춤 등). 종류의 기본 이름(겹치면 번호), 종류별 인스턴스 상한
function addKindTarget(store,kind){
  const k=KINDS[kind]; if(!k) return {ok:false,msg:'이 버전에서 지원하지 않는 종류예요'};
  if(store.targets.length>=TARGET_MAX) return {ok:false,msg:FULL_MSG};
  const base=k.defaultName||k.label;
  if(store.targets.filter(t=>t.kind===kind).length>=k.maxInstances) return {ok:false,msg:`${eunNeun(base)} ${k.maxInstances}개까지 둘 수 있어요`};
  let name=base, n=2; while(store.targets.some(t=>t.name===name)) name=`${base} ${n++}`;
  const t=newTarget(makeId(store),kind,name); store.targets.push(t); return {ok:true,target:t};
}

/* ----- 이름 바꾸기·순서·삭제 (순수. 화면 처리는 ui-cards.js) ----- */
function renameTarget(store,id,raw){
  const t=store.targets.find(x=>x.id===id); if(!t) return {ok:false,msg:'대상을 찾을 수 없어요'};
  const c=checkName(raw,store.targets,id); if(!c.ok) return {ok:false,msg:c.msg};
  t.name=c.name; return {ok:true,msg:''};            // id·내 소리 슬롯은 그대로
}
// delta -1(위)·+1(아래). 바뀐 새 위치를 돌려주고, 끝이라 못 움직이면 -1
function moveTarget(store,id,delta){
  const i=store.targets.findIndex(x=>x.id===id), j=i+delta;
  if(i<0||j<0||j>=store.targets.length) return -1;
  [store.targets[i],store.targets[j]]=[store.targets[j],store.targets[i]]; return j;
}
// 삭제 되돌리기: 같은 위치로 복원(위치가 목록 길이를 넘으면 끝). 그 사이 같은 이름이 생겼으면 (복원)을 붙인다
function insertTargetAt(store,t,index){
  if(store.targets.some(x=>x.name===t.name)) t.name=t.name.slice(0,6)+' (복원)';
  store.targets.splice(Math.min(index,store.targets.length),0,t);
}
function deleteConfirmText(name,soundCount){ return `"${name}" 대상을 지울까요?`+(soundCount?` 내 소리 ${soundCount}개도 함께 지워져요.`:''); }
function ownedSlotKeys(keys,id){ return keys.filter(k=>String(k).split('.')[0]===id); }

/* ----- 상태줄 요약 (스펙 5.6). rows는 targetSnapshot의 행. 켜진 대상이 6개 이상이면 정상은 한 덩어리로 묶는다 ----- */
// 돌려주는 항목: {type:'text',id,text,cls} | {type:'btn',id,label} | {type:'reregAll',ids,n,label} | {type:'okGroup',n,open,label}
function summarizeStrip(rows,open){
  const group=rows.filter(r=>r.enabled).length>=6;
  const reIds=rows.filter(r=>r.stripState==='rereg').map(r=>r.id);
  const items=[], oks=[]; let reDone=false;
  for(const r of rows){
    const s=r.stripState;
    if(s==='rereg'&&reIds.length>=3){ if(!reDone){ reDone=true; items.push({type:'reregAll',ids:reIds,n:reIds.length,label:`다시 등록 ${reIds.length}개 · 차례로 등록`}); } continue; }
    if(s==='reg'||s==='rereg'){ items.push({type:'btn',id:r.id,label:`${r.name} ${s==='reg'?'등록하기':'다시 등록'}`}); continue; }
    if(s==='ok'&&group){ oks.push(r.name); continue; }
    items.push({type:'text',id:r.id,cls:s==='ok'?'':s,text:r.stripText||(s==='off'?`${r.name} 꺼둠`:s==='unseen'?`${r.name} 아직 못 찾음`:r.name)});
  }
  if(oks.length){ items.push({type:'okGroup',n:oks.length,open:!!open,label:`정상 ${oks.length}개`}); if(open) for(const n of oks) items.push({type:'text',id:null,cls:'',text:n}); }
  return items;
}

/* ----- 내 소리 슬롯 키 = 대상id.이벤트 (묶음 1 스펙 4.4·4.5) ----- */
const MANUAL_SLOTS=[['manual.pre','미리 알림'],['manual.end','타이머 끝'],['manual.next1','구간 1 → 구간 2'],['manual.next2','구간 2 → 구간 1']];   // 묶음 2 스펙 6.1
// 소리 설정 화면의 행 목록. 대상이 추가·삭제·개명될 때마다 다시 계산한다. opts.manual=false면 수동 타이머(묶음 2) 슬롯을 뺀다
function slotsOf(targets,opts){
  const out=[], manual=!(opts&&opts.manual===false);
  for(const t of targets){ const k=KINDS[t.kind]; if(!k) continue; for(const e of k.events) if(!e.noSlot) out.push({key:`${t.id}.${e.key}`,group:t.name,label:e.label}); }
  out.push({key:'grp.pre',group:'묶음 알림',label:'미리 알림'},{key:'grp.gone',group:'묶음 알림',label:'꺼짐'});
  if(manual) for(const [key,label] of MANUAL_SLOTS) out.push({key,group:'수동 타이머',label});
  out.push({key:'sys.lost',group:'연결 문제',label:'연결 끊김'},{key:'sys.stall',group:'연결 문제',label:'화면 안 들어옴'});
  return out;
}
const RESERVED_OWNER=/^(sys|grp|manual|m\d+)$/;
// 저장된 소리 키 중 지울 것: 소유자가 예약 접두어도 현재 대상도 아닌 것. 저장소를 정상으로 읽었을 때(ok·migrated)만 지운다
function orphanSlots(keys,targets,status){
  if(status!=='ok'&&status!=='migrated') return [];
  const ids=new Set(targets.map(t=>t.id));
  return keys.filter(k=>{ const owner=String(k).split('.')[0]; return !RESERVED_OWNER.test(owner)&&!ids.has(owner); });
}

/* ----- 실행 중 저장소. 소유: 이 파일. 다른 파일은 store.targets를 읽고, 바꾼 뒤에는 saveTargets()를 부른다 ----- */
let store={ver:2,seq:0,targets:[],group:defaultGroup()}, storeStatus='fresh';   // initTargets()가 채운다(KINDS는 kinds.js가 뒤에 올라오므로 여기서 만들지 않음)
const targetById=id=>store.targets.find(t=>t.id===id);
let saveWarned=false;
function saveTargets(){
  if(saveStore(store)||saveWarned) return;
  saveWarned=true; setNote('설정을 저장하지 못했어요 (이 탭에서만 유지)');
}
function initTargets(){
  const r=loadStore(); store=r.store; storeStatus=r.status;
  if(r.status==='broken') setNote('설정을 읽지 못해 처음 상태로 시작했어요. 백업 파일이 있으면 불러오세요');
  else if(r.saveFailed){ saveWarned=true; setNote('설정을 저장하지 못했어요 (이 탭에서만 유지)'); }
}
if(typeof module==='object') module.exports={addKindTarget,summarizeStrip,renameTarget,moveTarget,insertTargetAt,deleteConfirmText,ownedSlotKeys,missingBuiltins,addBuiltin,addBuff,slotsOf,orphanSlots,BUILTIN,PRESETS,defaultStore,newTarget,builtinTarget,normalizeTarget,normalizeStore,makeId,migrateV1,loadStore,saveStore,checkName,targetSnapshot};
