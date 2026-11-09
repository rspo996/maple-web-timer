/* ===== 수동 타이머: 순수 함수 (묶음 2 스펙 5·6·8절). 화면을 보지 않고 사용자가 시작한 시간만 잰다.
   모든 함수는 now를 인자로 받고 입력 타이머를 바꾸지 않는다(새 객체를 돌려준다). ===== */
const MANUAL_STORE='maple-web-timer-manual-v1';
const MANUAL_MAX=8, MANUAL_MIN_SEC=10, MANUAL_PRE_MAX=120, MANUAL_LABEL_MAX=20;
const MANUAL_PRE_SKIP_MS=3000;   // 미리 알림 창에 들어온 지 3초 넘게 지난 뒤 알게 되면(틱이 늦음) 울리지 않는다
const MANUAL_LATE_MS=15000;      // 경계가 지난 지 15초 넘게 지나 알게 되면(잠자기 등) 소리 없이 따라잡는다
const MANUAL_PRESETS=[[300,'5분'],[600,'10분'],[900,'15분'],[1200,'20분'],[1800,'30분'],[3600,'1시간'],[7200,'2시간']];

function manualEmptyStore(){ return {v:1,seq:0,prefs:{preSec:10},presets:MANUAL_PRESETS.map(([sec,label],i)=>({id:'p'+(i+1),label,sec})),timers:[]}; }
// 같은 이름이 있으면 뒤에 번호(음성으로 구분하고, 같은 문구 8초 중복 억제에 걸리지 않게)
function manualUniqueLabel(label,timers,selfId){
  const taken=new Set(timers.filter(t=>t.id!==selfId).map(t=>t.label));
  if(!taken.has(label)) return label;
  for(let n=2;;n++){ const c=`${label} ${n}`; if(!taken.has(c)) return c; }
}
function manualNew(store,kind,label,phases,preSec){
  store.seq=(store.seq||0)+1;
  const ph=phases.map(p=>({name:p.name,sec:p.sec}));
  return {id:'m'+store.seq,label:manualUniqueLabel(label,store.timers||[]),kind,phases:ph,idx:0,cycles:0,status:'idle',endAt:null,
    remainMs:ph[0].sec*1000,preSec,preDone:false,preHeard:false,doneAt:null};
}
const phaseMs=(t,i)=>t.phases[i].sec*1000;
function manualRemainMs(t,now){
  if(t.status==='running') return Math.max(0,t.endAt-now);
  if(t.status==='done') return 0;
  return Math.max(0,t.remainMs);
}
function manualStart(t,now){
  if(t.status==='running') return t;
  if(t.status==='done') return {...manualReset(t),status:'running',endAt:now+phaseMs(t,0)};
  return {...t,status:'running',endAt:now+t.remainMs};
}
function manualPause(t,now){
  if(t.status!=='running') return t;
  return {...t,status:'paused',remainMs:Math.max(0,t.endAt-now),endAt:null};
}
function manualReset(t){ return {...t,idx:0,cycles:0,status:'idle',endAt:null,remainMs:phaseMs(t,0),preDone:false,preHeard:false,doneAt:null}; }
// 지금 구간의 남은 시간에 더하고 뺀다(구간 전체 길이는 그대로). 미리 알림 창 밖으로 나가면 다시 울릴 수 있게, 창 안으로 들어가면 울리지 않게
function manualAdjust(t,deltaMs,now){
  if(t.status==='done') return t;
  let o;
  if(t.status==='running') o={...t,endAt:Math.max(now,t.endAt+deltaMs)};
  else o={...t,remainMs:Math.max(0,t.remainMs+deltaMs)};
  const rem=manualRemainMs(o,now);
  if(rem>o.preSec*1000) return {...o,preDone:false,preHeard:false};
  if(!o.preDone) return {...o,preDone:true};
  return o;
}
// 올림해서 m:ss, 1시간 이상은 h:mm:ss
function manualFmt(ms){
  const s=Math.max(0,Math.ceil(ms/1000)), h=Math.floor(s/3600), m=Math.floor(s%3600/60), x=String(s%60).padStart(2,'0');
  return h?`${h}:${String(m).padStart(2,'0')}:${x}`:`${m}:${x}`;
}

if(typeof module==='object') module.exports={MANUAL_STORE,MANUAL_MAX,MANUAL_MIN_SEC,MANUAL_PRE_MAX,MANUAL_PRE_SKIP_MS,MANUAL_LATE_MS,MANUAL_PRESETS,
  manualEmptyStore,manualUniqueLabel,manualNew,manualRemainMs,manualStart,manualPause,manualReset,manualAdjust,manualFmt};
