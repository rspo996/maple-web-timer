/* ===== 사냥 멈춤 알림 (묶음 3): 경험치 막대·숫자 영역이 정한 시간 동안 안 바뀌면 알린다.
   위쪽은 순수 함수(node 시험), 아래쪽은 KINDS.idle 종류 정의(영역 자르기·기준 프레임은 step 안에서) ===== */
const IDLE_DELTA=24;          // 회색조 차이가 이 값 이상인 픽셀만 "바뀜"으로 센다(압축 잡음 무시) [추정]
const IDLE_ALERTS=3;          // 처음 1번 + 반복 2번에서 멈춤(사용자 결정)
const IDLE_UNTIL_GRACE=15000; // "다시 변할 때까지" 쉬기는 시작 15초 안의 변화(화면 전환 잔상)를 무시
const IDLE_WINDOW=60000;      // 측정 표시·계속 변함 판정에 쓰는 최근 구간

// 두 회색조 배열에서 차이가 minDelta 이상인 픽셀 수
function lumaDiffCount(a,b,minDelta){
  let n=0; const len=Math.min(a.length,b.length);
  for(let i=0;i<len;i++){ const d=a[i]-b[i]; if(d>=minDelta||d<=-minDelta) n++; }
  return n;
}
function idleNewState(){
  return {phase:'init',gap:true,lastChangeAt:0,streak:0,count:0,nextAlertAt:Infinity,exhausted:false,
    snoozeMode:null,snoozeStartAt:0,snoozeUntil:0,recent:[],confirms:[]};
}
/* 한 틱. obs={px}|null(믿을 수 없는 틱: 화면 안 들어옴·암전·등록 중·해상도 다름·오래된 프레임·스크린샷).
   돌려주는 것: 'rebase'(호출자가 기준 프레임 교체), 'confirm'(변화 확정, 기준 교체), {resume:{stoppedSec}},
   'snooze-end', {idle:{elapsedSec, repeat}}(알림) */
function stepIdle(S,cfg,obs,now){
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
function idleStartSnooze(S,mode,now){
  S.phase='snooze'; S.snoozeMode=mode; S.snoozeStartAt=now; S.count=0; S.nextAlertAt=Infinity; S.exhausted=false;
  S.snoozeUntil=mode==='10m'?now+600000:mode==='30m'?now+1800000:Infinity;
}
function idleEndSnooze(S,now){ S.phase='watch'; S.snoozeMode=null; S.snoozeUntil=0; S.lastChangeAt=now; S.streak=0; S.count=0; S.nextAlertAt=Infinity; }
function idleText(sec){ return sec<60?`경험치가 ${sec}초째 그대로예요`:`경험치가 ${Math.floor(sec/60)}분째 그대로예요`; }
// 최근 60초 측정값: 변화량 최대·중앙값·확정 횟수·변함 비율(카드에 보여 minPx를 정하게 한다)
function idleStats(S,now,minPx=Infinity){
  const r=S.recent.filter(x=>now-x.at<=IDLE_WINDOW), px=r.map(x=>x.px).sort((a,b)=>a-b);
  return {max:px.length?px[px.length-1]:0,med:px.length?px[(px.length-1)>>1]:0,confirms:S.confirms.filter(t=>now-t<=IDLE_WINDOW).length,
    n:r.length,changedRatio:r.length?r.filter(x=>x.px>=minPx).length/r.length:0};
}
if(typeof module==='object') module.exports={IDLE_DELTA,IDLE_ALERTS,lumaDiffCount,idleNewState,stepIdle,idleStartSnooze,idleEndSnooze,idleText,idleStats};
