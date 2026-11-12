/* ===== 종류 등록부 KINDS (묶음 1 스펙 3.4, 16절). 종류별 동작은 여기 한 곳에 둔다.
   묶음 3(idle)·4(cooldown)는 registerKind(이름, 정의)로 종류를 더한다. 이 파일은 정의만 하고 DOM은 호출 시점에만 건드린다. 화면·캡처 쪽 기능은 hooks로 부른다. ===== */
import {HOLD_GRACE_MS,UNREAD_MS,stepCountdown,stepDetector} from './detect-core.js';
import {hooks} from './hooks.js';
import {checkDurLead,clampInt,fmt} from './util.js';
export const KINDS={};
export const isPresetMode=t=>!t.tpl&&!!t.preset;                    // 직접 등록한 아이콘이 없고 내장 아이콘을 쓰는 중
export const sayName=t=>t.sayName||t.name;                           // 부를 이름: 음성과 알림 문구(토스트·탭 제목·브라우저 알림)에 쓴다. 카드·작은 창·소리 설정에는 name을 그대로 보인다
export const cfgView=t=>({kind:t.kind,...t.p});                      // 기존 순수 상태기계(stepDetector 등)에 넘기는 설정 모양
export function unionRect(a,i){ const x0=Math.min(a.x,i.x),y0=Math.min(a.y,i.y),x1=Math.max(a.x+a.w,i.x+i.w),y1=Math.max(a.y+a.h,i.y+i.h); return {x:x0,y:y0,w:x1-x0,h:y1-y0}; }
// 영역 → 아이콘으로 드래그한 결과를 저장. 아이콘이 영역 밖으로 나가면 영역을 넓힌다
export function templateRegisterSave(t,rects,snap){
  const r=rects.icon, cv=document.createElement('canvas'); cv.width=r.w; cv.height=r.h;
  cv.getContext('2d').drawImage(snap,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
  Object.assign(t,{area:unionRect(rects.area,r),tpl:{url:cv.toDataURL('image/png'),w:r.w,h:r.h},frameW:snap.width,frameH:snap.height});
}
export function labelsOf(t){ return KINDS[t.kind].labels(t); }
// 등록·연결·해상도 같은 공통 분기. 해당하지 않으면 null
export function commonStatus(k,t,ctx){
  if(!k.isRegistered(t)){ const l=k.labels(t); return {text:'등록 필요',cls:'off',sub:`${l.area} → ${l.icon} 순서로 드래그`}; }
  if(!ctx.src) return {text:'대기 중',cls:'off',sub:'게임 화면을 연결하세요'};
  if(k.needsReregister(t,ctx.frame)) return {text:'다시 등록 필요',cls:'alert',sub:`등록 당시 화면 ${t.frameW}×${t.frameH}, 지금 ${ctx.frame.w}×${ctx.frame.h}`};
  return null;
}
export const NOT_SEEN={text:'아직 못 찾음',cls:'off',sub:'이번 연결에서 아직 한 번도 못 봤어요 · 켜져 있는데도 이러면 “등록”으로 직접 지정'};
export const KIND_DEFAULTS={
  label:'', needsTemplate:true, usesThreshold:true, trackSeen:false, maxInstances:12, onSkip:false, events:[], actions:[],
  timerBand:null,                                              // [lo, hi]: 템플릿 비교에서 뺄 가운데 행 띠(높이 비율). 버프만 쓴다
  defaults:()=>({}), normalizeP:p=>p,
  isRegistered:t=>!!(t.tpl||t.preset),
  needsReregister:(t,frame)=>!!(t.tpl&&t.frameW&&frame&&frame.w&&(t.frameW!==frame.w||t.frameH!==frame.h)),
  register:{steps:['area','icon'],validate:()=>null,save:templateRegisterSave},   // validate가 문자열을 돌려주면 저장하지 않고 그 이유를 배너에 보인다
  labels:t=>({area:'영역',icon:`${t.name} 아이콘`}),
  detect:(t,source,ctx)=>hooks.detectTemplate(t,source),
  step:()=>[],
  markPre:st=>{ st.alertedPre=true; },                        // 묶기로 미리 당겨 알렸거나 자체 pre를 울린 주기를 표시
  remainSec:()=>null, applyEffect:()=>{}, cardFields:()=>[], cost:t=>t.tpl?5:80,
  gauge:()=>null,                                              // 카드 게이지 {frac:0~1, low}. 전체 길이를 아는 종류만 돌려준다(모르면 그리지 않음)
  status:(t,st,now,ctx)=>commonStatus(KINDS[t.kind],t,ctx)||{text:'',cls:'off',sub:''},
  stripState(t,st,now,ctx){
    const k=KINDS[t.kind];
    if(!t.enabled) return 'off'; if(!k.isRegistered(t)) return 'reg'; if(k.needsReregister(t,ctx&&ctx.frame)) return 'rereg';
    return k.trackSeen&&!st.seen?'unseen':'ok';
  },
};
export function registerKind(name,def){
  KINDS[name]=Object.assign({},KIND_DEFAULTS,def,{key:name,register:Object.assign({},KIND_DEFAULTS.register,def.register||{})});
}
// 카드 상태 문구. 내장 아이콘을 쓰는 중이고 안내가 없으면 자동 검색 중이라는 안내를 붙인다
export function cardStatus(t,st,now,ctx){
  const r=Object.assign({sub:''},KINDS[t.kind].status(t,st,now,ctx));
  if(!r.sub&&isPresetMode(t)&&ctx.src) r.sub=t.kind==='countdown'?'화면 위쪽 가운데의 “남은시간” 타이머를 자동 검색 중'
    :t.kind==='rune'?'미니맵(화면 왼쪽 위)에서 룬 아이콘을 자동 검색 중 · 잘 안 잡히면 “등록”으로 직접 지정'
    :'기본 아이콘으로 화면 오른쪽 위를 자동 검색 중 · 잘 안 잡히면 “등록”으로 직접 지정';
  return r;
}
// 읽은 숫자로 세는 남은 시간(버프·부스터 공용). 숫자를 아직 못 읽었거나 이미 알렸거나 끝났으면 null
export function remainOf(st,now){
  if(!st.present||st.alertedPre||st.remain==null) return null;
  const r=st.remain-(now-st.remainAt)/1000; return r>0?r:null;
}
// 묶기로 미리 당겨 알렸거나 자체 pre를 울린 주기를 표시. 그때의 남은 시간을 기억해, 그보다 훨씬 큰 값을 읽어야 새 주기로 본다(stepCountdown)
export function markPreRemain(st,now){ st.alertedPre=true; st.preMarkRemain=st.remain!=null?Math.max(0,st.remain-(now-st.remainAt)/1000):0; }
export const leadField={key:'leadSec',label:'미리 알림',type:'number',min:1,max:120,suffix:'초 전',
  get:t=>t.p.leadSec,
  set:(t,raw)=>{ const v=clampInt(raw,1,120,10); const m=checkDurLead(t.p.durationSec,v,'lead'); if(m) return {revert:true,msg:m}; t.p.leadSec=v; return {}; }};

registerKind('buff',{
  label:'버프', trackSeen:true,
  // 메이플은 남은 시간이 짧아진 버프 아이콘을 어둡게 덮고 가운데에 노란 숫자(예: 2:54, 23)를 찍는다. 숫자가 매초 바뀌므로 그 띠를 빼고 비교한다.
  // 실제 화면(2026-11-10 스크린샷)에서 숫자는 아이콘(가장자리 2px 뺀 28px) 높이의 약 0.29~0.75. 위아래로 조금 여유를 둔다
  timerBand:[0.27,0.78],
  // 지속시간 칸·자동 학습·"방금 켰어요"를 없앴다(2026-11-11 사용자 결정: 지속시간은 사람마다 다르고, 학습 중 맵 이동 등으로 짧게 배우면 계속 일찍 울렸다).
  // 대신 아이콘에 찍힌 남은 시간 숫자를 읽어 부스터와 같은 방식(stepCountdown)으로 센다. 예전 설정의 지속시간은 불러올 때 버린다
  defaults:()=>({leadSec:10}),
  normalizeP:p=>{ const {durationSec,...rest}=p; return {...rest,leadSec:clampInt(p.leadSec,1,120,10)}; },
  labels:t=>({area:'버프창 영역',icon:`${t.name} 아이콘`}),
  events:[
    {key:'pre',label:'미리 알림',beep:'buff',group:'pre',msg:t=>`${sayName(t)} 곧 꺼져요`},
  ],   // 꺼짐 알림 없음(2026-11-10 사용자 결정). stepDetector의 gone은 감지 루프(collectEvents)가 버린다
  step(t,st,det,source,now){
    const hit=det.score>=t.threshold, evs=stepDetector(st,cfgView(t),hit,now); if(st.present) st.seen=true;
    const o=st.present&&hit?hooks.readBuffTimer(source,det.pos):null; if(o&&o.read) st.lastText=o.read.text;
    // 30분짜리처럼 긴 버프는 끝나기 몇 분 전까지 큰 숫자가 없으므로 '숫자 못 읽음'은 버프에 쓰지 않는다
    evs.push(...stepCountdown(st,cfgView(t),o&&o.read?o.read.value:null,now).filter(e=>e!=='unread'));
    return evs;
  },
  markPre:markPreRemain,
  remainSec:(t,st,now)=>remainOf(st,now),
  status(t,st,now,ctx){
    const c=commonStatus(KINDS.buff,t,ctx); if(c) return c;
    if(!st.present&&!st.seen) return NOT_SEEN;
    if(!st.present) return {text:'꺼져 있음',cls:'off',sub:''};
    if(st.remain==null) return {text:'켜짐',cls:'on',sub:'아이콘에 남은 시간 숫자가 보이면 그 숫자로 미리 알려요'};
    const rem=st.remain-(now-st.remainAt)/1000;
    return {text:'남은 시간 '+fmt(rem),cls:rem<=t.p.leadSec?'alert':'on',sub:'아이콘 숫자 '+st.lastText};
  },
  cardFields:()=>[leadField],
});

registerKind('countdown',{
  label:'카운트다운', trackSeen:true,
  defaults:()=>({leadSec:10}),
  normalizeP:p=>({...p,leadSec:clampInt(p.leadSec,1,120,10)}),
  labels:()=>({area:'남은시간 타이머 주변',icon:'“◷ 남은시간” 글자'}),
  events:[
    {key:'pre',label:'미리 알림',beep:'booster',group:'pre',msg:t=>`${sayName(t)} 곧 꺼져요`},
    // 꺼짐 알림 없음(2026-11-10 사용자 결정)
    {key:'unread',label:'숫자 못 읽음',beep:'system',group:null,msg:t=>`${t.name} 숫자를 못 읽고 있어요`},
  ],
  step(t,st,det,source,now){
    // 숫자를 읽어 남은 시간을 알면, 그 시간이 다 될 때까지는 “남은시간” 글자가 안 보여도 가려진 것으로 보고 꺼짐 알림을 하지 않는다
    const holdUntil=st.present&&st.remain!=null?st.remainAt+st.remain*1000+HOLD_GRACE_MS:0;
    const hit=det.score>=t.threshold, evs=stepDetector(st,{...cfgView(t),holdUntil},hit,now); if(st.present) st.seen=true;
    const o=st.present&&hit?hooks.readTimer(source,det.pos):null; st.ocrRect=o&&o.rect; if(o&&o.read) st.lastText=o.read.text;
    evs.push(...stepCountdown(st,cfgView(t),o&&o.read?o.read.value:null,now));
    return evs;
  },
  markPre:markPreRemain,
  remainSec:(t,st,now)=>remainOf(st,now),
  status(t,st,now,ctx){
    const c=commonStatus(KINDS.countdown,t,ctx); if(c) return c;
    if(!st.present&&!st.seen) return NOT_SEEN;
    if(!st.present) return {text:'꺼져 있음',cls:'off',sub:''};
    const stuck=`숫자를 ${UNREAD_MS/1000}초 넘게 못 읽었어요`;
    if(st.remain==null) return {text:st.ocrWarned?'켜짐 · 숫자를 못 읽음':'켜짐 · 숫자 읽는 중',cls:st.ocrWarned?'alert':'on',
      sub:st.ocrWarned?stuck+' · 안 되면 “등록”으로 “◷ 남은시간” 글자를 직접 지정':st.lastText?'읽은 값 '+st.lastText:'타이머 숫자를 아직 못 읽었어요'};
    const rem=st.remain-(now-st.remainAt)/1000;
    return {text:'남은 시간 '+fmt(rem),cls:rem<=t.p.leadSec?'alert':'on',
      sub:st.held?'“남은시간” 글자가 가려져 있어요 · 읽어 둔 시간으로 계속 세요':st.ocrWarned?stuck+' · 이 시간은 추정이에요':'읽은 값 '+st.lastText+'초'};
  },
  cardFields:()=>[{...leadField,set:(t,raw)=>{ t.p.leadSec=clampInt(raw,1,120,10); return {}; }}],   // 부스터는 지속시간이 없어 검사할 것이 없다
});

registerKind('rune',{
  label:'룬',
  defaults:()=>({repeatSec:60}),
  normalizeP:p=>({...p,repeatSec:clampInt(p.repeatSec,0,600,60)}),
  labels:()=>({area:'미니맵 영역',icon:'룬 아이콘'}),
  events:[
    {key:'appear',label:'나왔을 때',beep:'rune',group:null,msg:()=>'룬이 나왔어요'},
    {key:'remind',label:'아직 있을 때',beep:'rune',group:null,msg:()=>'룬 아직 있어요'},
  ],
  step(t,st,det,source,now){ const evs=stepDetector(st,cfgView(t),det.score>=t.threshold,now); if(st.present) st.seen=true; return evs.map(e=>e==='appear-unknown'?'appear':e); },
  status(t,st,now,ctx){
    const c=commonStatus(KINDS.rune,t,ctx); if(c) return c;
    return {text:st.present?'룬 있음!':'룬 없음',cls:st.present?'alert':'off',sub:''};
  },
  cardFields:()=>[{key:'repeatSec',label:'반복 알림',type:'number',min:0,max:600,suffix:'초마다',hint:'(0=끔)',
    get:t=>t.p.repeatSec, set:(t,raw)=>{ t.p.repeatSec=clampInt(raw,0,600,0); return {}; }}],
});
