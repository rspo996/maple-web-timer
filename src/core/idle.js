/* ===== 사냥 멈춤 알림 (묶음 3): 경험치 막대·숫자 영역이 정한 시간 동안 안 바뀌면 알린다.
   위쪽은 순수 함수(node 시험), 아래쪽은 KINDS.idle 종류 정의(영역 자르기·기준 프레임은 step 안에서) ===== */
import {hooks} from './hooks.js';
import {KINDS,KIND_DEFAULTS,commonStatus,registerKind} from './kinds.js';
import {toGray} from './match.js';
import {scratch} from './scratch.js';
import {clampInt,fmt,parseDur} from './util.js';
export const IDLE_DELTA=24;          // 회색조 차이가 이 값 이상인 픽셀만 "바뀜"으로 센다(압축 잡음 무시) [추정]
export const IDLE_ALERTS=3;          // 처음 1번 + 반복 2번에서 멈춤(사용자 결정)
export const IDLE_UNTIL_GRACE=15000; // "다시 변할 때까지" 쉬기는 시작 15초 안의 변화(화면 전환 잔상)를 무시
export const IDLE_WINDOW=60000;      // 측정 표시·계속 변함 판정에 쓰는 최근 구간

// 두 회색조 배열에서 차이가 minDelta 이상인 픽셀 수
export function lumaDiffCount(a,b,minDelta){
  let n=0; const len=Math.min(a.length,b.length);
  for(let i=0;i<len;i++){ const d=a[i]-b[i]; if(d>=minDelta||d<=-minDelta) n++; }
  return n;
}
export function idleNewState(){
  return {phase:'init',gap:true,lastChangeAt:0,streak:0,count:0,nextAlertAt:Infinity,exhausted:false,
    snoozeMode:null,snoozeStartAt:0,snoozeUntil:0,recent:[],confirms:[]};
}
/* 한 틱. obs={px}|null(믿을 수 없는 틱: 화면 안 들어옴·암전·등록 중·해상도 다름·오래된 프레임·스크린샷).
   돌려주는 것: 'rebase'(호출자가 기준 프레임 교체), 'confirm'(변화 확정, 기준 교체), {resume:{stoppedSec}},
   'snooze-end', {idle:{elapsedSec, repeat}}(알림) */
export function stepIdle(S,cfg,obs,now){
  const ev=[];
  if(S.phase==='snooze'&&now>=S.snoozeUntil){ idleEndSnooze(S,now); ev.push('snooze-end'); }   // 쉬기 끝 시각은 null 틱에도 점검
  if(obs==null){ S.gap=true; return ev; }
  if(S.gap){                                   // 첫 유효 샘플 또는 끊긴 뒤: 기준만 새로 잡고 시간은 처음부터
    S.gap=false; S.lastChangeAt=now; S.streak=0;
    if(S.phase==='init') S.phase='watch';
    if(S.phase==='idle'){ if(S.count>=IDLE_ALERTS) S.exhausted=true; S.phase='watch'; }   // 3번 다 울린 멈춤은 끊김으로 다시 울리지 않는다
    S.count=0; S.nextAlertAt=Infinity;
    ev.push('rebase'); return ev;
  }
  S.streak=obs.px>=cfg.minPx?S.streak+1:0;
  if(S.streak>=2){                             // 2틱 연속 달라야 변화로 확정(한 프레임짜리 번쩍임 무시)
    const stoppedSec=Math.round((now-S.lastChangeAt)/1000);
    S.streak=0; S.lastChangeAt=now; S.exhausted=false; ev.push('confirm');
    if(S.phase==='idle'){ S.phase='watch'; S.count=0; S.nextAlertAt=Infinity; ev.push({resume:{stoppedSec}}); }
    if(S.phase==='snooze'&&S.snoozeMode==='until-change'&&now-S.snoozeStartAt>=IDLE_UNTIL_GRACE){ idleEndSnooze(S,now); ev.push('snooze-end'); }
    return ev;
  }
  const elapsedSec=Math.round((now-S.lastChangeAt)/1000), next=cfg.repeatSec>0?now+cfg.repeatSec*1000:Infinity;
  if(S.phase==='watch'&&!S.exhausted&&now-S.lastChangeAt>=cfg.idleSec*1000){
    S.phase='idle'; S.count=1; S.nextAlertAt=next; ev.push({idle:{elapsedSec,repeat:false}});
  } else if(S.phase==='idle'&&S.count<IDLE_ALERTS&&now>=S.nextAlertAt){
    S.count++; S.nextAlertAt=next; ev.push({idle:{elapsedSec,repeat:true}});
  }
  return ev;
}
// 쉬기: 10m·30m·until-change. 시작하면 알림 횟수를 비운다. 끝나면 시간을 처음부터 센다
export function idleStartSnooze(S,mode,now){
  S.phase='snooze'; S.snoozeMode=mode; S.snoozeStartAt=now; S.count=0; S.nextAlertAt=Infinity; S.exhausted=false;
  S.snoozeUntil=mode==='10m'?now+600000:mode==='30m'?now+1800000:Infinity;
}
export function idleEndSnooze(S,now){ S.phase='watch'; S.snoozeMode=null; S.snoozeUntil=0; S.lastChangeAt=now; S.streak=0; S.count=0; S.nextAlertAt=Infinity; }
export function idleText(sec){ return sec<60?`경험치가 ${sec}초째 그대로예요`:`경험치가 ${Math.floor(sec/60)}분째 그대로예요`; }
// 최근 60초 측정값: 변화량 최대·중앙값·확정 횟수·변함 비율(카드에 보여 minPx를 정하게 한다)
export function idleStats(S,now,minPx=Infinity){
  const r=S.recent.filter(x=>now-x.at<=IDLE_WINDOW), px=r.map(x=>x.px).sort((a,b)=>a-b);
  return {max:px.length?px[px.length-1]:0,med:px.length?px[(px.length-1)>>1]:0,confirms:S.confirms.filter(t=>now-t<=IDLE_WINDOW).length,
    n:r.length,changedRatio:r.length?r.filter(x=>x.px>=minPx).length/r.length:0};
}

/* ----- 종류 정의: KINDS.idle (이 모듈을 import하면 KINDS에 등록된다) ----- */
export const idleS=st=>st.idle||(st.idle=idleNewState());
export const idleSecText=s=>s<60?`${s}초`:`${Math.floor(s/60)}분`;
// 등록 영역을 1:1로 잘라 회색조로. 실패하면 null(카드에 "영역을 읽지 못했어요")
export function idleSample(t,source){
  try{ const {work,wctx}=scratch(), a=t.area; work.width=a.w; work.height=a.h; wctx.drawImage(source,a.x,a.y,a.w,a.h,0,0,a.w,a.h); return toGray(wctx.getImageData(0,0,a.w,a.h).data,a.w*a.h); }
  catch(e){ return null; }
}
export const idleClamp=(v,lo,hi,d)=>{ const n=Math.round(+v); return Number.isFinite(n)?Math.min(hi,Math.max(lo,n)):d; };
export const IDLE_BUSY_ON=0.9, IDLE_BUSY_OFF=0.7, IDLE_PROBE_MS=10000;
registerKind('idle',{
  label:'사냥 멈춤', menuLabel:'사냥 멈춤', defaultName:'사냥 멈춤', maxInstances:1, onSkip:true, usesThreshold:false, needsTemplate:false,
  defaults:()=>({idleSec:120,repeatSec:120,minPx:8,thumb:null}),
  normalizeP:p=>({...p,idleSec:idleClamp(p.idleSec,10,3600,120),repeatSec:idleClamp(p.repeatSec,0,600,120),minPx:idleClamp(p.minPx,3,60,8),   // 저장값은 범위로 자른다(스펙 4.3)
    thumb:typeof p.thumb==='string'&&p.thumb.startsWith('data:image/')?p.thumb:null}),
  labels:()=>({area:'경험치 막대와 숫자',icon:''}),
  isRegistered:t=>!!t.area,
  needsReregister:(t,frame)=>!!(t.area&&t.frameW&&frame&&frame.w&&(t.frameW!==frame.w||t.frameH!==frame.h)),
  register:{
    steps:['area'],
    stepText:{area:()=>'경험치 막대와 숫자를 한 번에 꼭 맞게 드래그하세요 · 경험치 숫자나 퍼센트가 영역에 들어가야 해요'},
    // 넓으면 화면의 다른 움직임이 섞여 영영 안 울린다. 8%·40%는 실제 화면 없이 정한 값 [추정]
    validate(t,rects,snap){
      const r=rects.area;
      if(r.w<40||r.h<6) return '영역이 너무 작아요';
      if(r.h>snap.height*0.08||r.w>snap.width*0.4) return '영역이 너무 넓어요. 경험치 막대와 숫자만 드래그해 주세요';
      return null;
    },
    save(t,rects,snap){
      const r=rects.area, k=Math.min(1,200/r.w), cv=document.createElement('canvas'); cv.width=Math.max(1,Math.round(r.w*k)); cv.height=Math.max(1,Math.round(r.h*k));
      cv.getContext('2d').drawImage(snap,r.x,r.y,r.w,r.h,0,0,cv.width,cv.height);
      Object.assign(t,{area:{...r},tpl:null,frameW:snap.width,frameH:snap.height}); t.p.thumb=cv.toDataURL('image/png');
    },
    doneNote:t=>`${t.name} 등록했어요 · 사냥하면서 변화량 숫자가 움직이는지 확인해 주세요`,
  },
  events:[
    {key:'alarm',label:'멈춤 알림',beep:'idle',group:null,msg:(t,i)=>idleText(i&&i.elapsedSec!=null?i.elapsedSec:t.p.idleSec)},
    {key:'busy',label:'영역이 계속 변함',beep:null,group:null,noSlot:true,msg:t=>`${t.name} 영역이 계속 변해서 감시할 수 없어요`},
  ],
  detect:()=>null,                                     // 템플릿을 찾지 않는다. 영역 자르기는 step에서(스펙 17-3)
  step(t,st,det,source,now,ctx){
    const S=idleS(st); let obs=null, g=null; S.readError=false;
    if(source&&ctx&&ctx.live&&ctx.fresh!==false&&t.area&&!KINDS.idle.needsReregister(t,ctx.frame)){   // 스크린샷·오래된 프레임·해상도 다름은 null
      g=idleSample(t,source);
      if(g) obs={px:S.anchor&&S.anchor.length===g.length?lumaDiffCount(S.anchor,g,IDLE_DELTA):0}; else S.readError=true;
    }
    const out=[];
    for(const e of stepIdle(S,t.p,obs,now)){
      if(e==='rebase'||e==='confirm'){ S.anchor=g; if(e==='confirm') S.confirms.push(now); }
      else if(e&&e.resume) S.resumed={at:now,stoppedSec:e.resume.stoppedSec};
      else if(e&&e.idle) out.push({key:'alarm',info:{elapsedSec:e.idle.elapsedSec}});
    }
    S.lastPx=obs?obs.px:null;
    if(obs){
      S.recent.push({at:now,px:obs.px});
      while(S.recent.length&&now-S.recent[0].at>IDLE_WINDOW) S.recent.shift();
      while(S.confirms.length&&now-S.confirms[0]>IDLE_WINDOW) S.confirms.shift();
      const stats=idleStats(S,now,t.p.minPx);
      if(!S.busy&&stats.n>=100&&stats.changedRatio>=IDLE_BUSY_ON){ S.busy=true; out.push({key:'busy',info:{}}); }   // 한 번만 말한다
      else if(S.busy&&stats.changedRatio<IDLE_BUSY_OFF) S.busy=false;
      if(S.probeFrom==null) S.probeFrom=now;              // 상태가 새로 시작된 뒤 10초 동안 절반 넘게 변하면 영역이 잘못 잡힌 것
      if(!S.probeDone&&now-S.probeFrom>=IDLE_PROBE_MS){
        S.probeDone=true; const r=S.recent.filter(x=>x.at>S.probeFrom);
        if(r.length>=6&&r.filter(x=>x.px>=t.p.minPx).length>r.length/2) hooks.setNote('이 영역은 계속 변해요. 경험치 숫자와 바만 들어가게 다시 잡아 주세요');
      }
    }
    return out;
  },
  status(t,st,now,ctx){
    if(!t.area) return {text:'등록 필요',cls:'off',sub:'경험치 막대와 숫자를 드래그'};
    const c=commonStatus(KINDS.idle,t,ctx); if(c) return c;
    if(!ctx.live) return {text:'테스트에서는 쉬어요',cls:'off',sub:'스크린샷은 변하지 않아서 멈춤 감지를 하지 않아요'};
    const S=st.idle||idleNewState();
    if(S.readError) return {text:'영역을 읽지 못했어요',cls:'alert',sub:'다시 등록해 보세요'};
    if(S.phase==='snooze') return {text:S.snoozeUntil===Infinity?'쉬는 중 · 다시 변할 때까지':`쉬는 중 ${fmt((S.snoozeUntil-now)/1000)} 남음`,cls:'off',sub:'쉬기를 끝내면 시간을 처음부터 다시 셉니다'};
    if(S.busy) return {text:'영역이 계속 변해요',cls:'alert',sub:'경험치 막대와 숫자만 드래그해 주세요'};
    if(S.phase==='init') return {text:'확인 중',cls:'off',sub:'게임 화면을 받으면 시간을 재기 시작해요'};
    if(S.gap) return {text:'쉬는 중 · 화면이 안 들어와요',cls:'off',sub:'화면이 돌아오면 시간을 처음부터 다시 셉니다'};
    const el=Math.max(0,(now-S.lastChangeAt)/1000);
    if(S.phase==='idle') return {text:`멈춤 · 경험치 그대로 ${fmt(el)}`,cls:'alert',sub:'다시 변하면 자동으로 풀려요'};
    const resumed=S.resumed&&now-S.resumed.at<180000?`${idleSecText(S.resumed.stoppedSec)} 멈췄다가 다시 변했어요`:'';
    if(el<10) return {text:'경험치가 움직여요',cls:'on',sub:resumed||`마지막 변화 ${Math.floor(el)}초 전`};
    if(S.exhausted) return {text:`경험치 그대로 ${fmt(el)}`,cls:'alert',sub:'알림을 세 번 울렸어요 · 다시 변하면 다시 알려요'};
    return {text:`경험치 그대로 ${fmt(el)}`,cls:'on',sub:resumed||`멈춤 알림까지 ${fmt(t.p.idleSec-el)}`};
  },
  stripState(t,st,now,ctx){
    const base=KIND_DEFAULTS.stripState(t,st,now,ctx); if(base!=='ok') return base;
    const S=st.idle; if(!S) return 'ok';
    return S.phase==='snooze'?'snooze':S.busy?'busy':S.phase==='idle'?'idle':'ok';
  },
  stripText:(t,st,s)=>s==='snooze'?`${t.name} 쉬는 중`:s==='idle'?`${t.name} · 경험치 그대로`:s==='busy'?`${t.name} 영역 확인 필요`:null,
  scoreRow(t,st,now){
    const S=st.idle; if(!S||S.lastPx==null) return {label:'변화량',text:'–'};
    const x=idleStats(S,now,t.p.minPx);
    return {label:'변화량',text:`${S.lastPx}픽셀${S.lastPx>=t.p.minPx?' ✔':''} · 최근 60초 최대 ${x.max} · 중앙 ${x.med} · 변화 ${x.confirms}번`};
  },
  thumb:t=>t.p.thumb||'',
  previewLabel(t,st){
    if(!t.area) return null; const S=st.idle, px=S&&S.lastPx!=null?S.lastPx:0;
    return {rect:t.area,text:`${t.name} 변화 ${px} / 기준 ${t.p.minPx}`,hit:px>=t.p.minPx,color:'#6aa1ff'};
  },
  cardFields:()=>[
    {key:'idleSec',label:'멈춤 시간',type:'text',placeholder:'2:00',suffix:'분:초',get:t=>fmt(t.p.idleSec),
     set:(t,raw)=>{ const v=parseDur(raw); if(!v) return {revert:true}; if(v<10||v>3600) return {revert:true,msg:'멈춤 시간은 10초~60분으로 입력해 주세요'}; t.p.idleSec=v; return {}; }},
    {key:'repeatSec',label:'반복 알림',type:'number',min:0,max:600,suffix:'초마다',hint:'(0=끔, 최대 2번)',get:t=>t.p.repeatSec,set:(t,raw)=>{ t.p.repeatSec=clampInt(raw,0,600,0); return {}; }},
    {key:'minPx',label:'변화 기준',type:'number',min:3,max:60,suffix:'픽셀',get:t=>t.p.minPx,set:(t,raw)=>{ t.p.minPx=clampInt(raw,3,60,8); return {}; }},
  ],
  actions:[
    {key:'snz10',label:'10분 쉬기',visible:(t,st)=>idleS(st).phase!=='snooze',run:(t,st,now)=>idleStartSnooze(idleS(st),'10m',now)},
    {key:'snz30',label:'30분 쉬기',visible:(t,st)=>idleS(st).phase!=='snooze',run:(t,st,now)=>idleStartSnooze(idleS(st),'30m',now)},
    {key:'snzUntil',label:'변할 때까지 쉬기',visible:(t,st)=>idleS(st).phase!=='snooze',run:(t,st,now)=>idleStartSnooze(idleS(st),'until-change',now)},
    {key:'snzEnd',label:'쉬기 끝내기',visible:(t,st)=>idleS(st).phase==='snooze',run:(t,st,now)=>idleEndSnooze(idleS(st),now)},
  ],
});
