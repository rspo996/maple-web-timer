/* ===== 수동 타이머: 순수 함수 (묶음 2 스펙 5·6·8절). 화면을 보지 않고 사용자가 시작한 시간만 잰다.
   모든 함수는 now를 인자로 받고 입력 타이머를 바꾸지 않는다(새 객체를 돌려준다). ===== */
export const MANUAL_STORE='maple-web-timer-manual-v1';
export const MANUAL_MAX=8, MANUAL_MIN_SEC=10, MANUAL_PRE_MAX=120, MANUAL_LABEL_MAX=20;
export const MANUAL_PRE_SKIP_MS=3000;   // 미리 알림 창에 들어온 지 3초 넘게 지난 뒤 알게 되면(틱이 늦음) 울리지 않는다
export const MANUAL_LATE_MS=15000;      // 경계가 지난 지 15초 넘게 지나 알게 되면(잠자기 등) 소리 없이 따라잡는다
export const MANUAL_PRESETS=[[300,'5분'],[600,'10분'],[900,'15분'],[1200,'20분'],[1800,'30분'],[3600,'1시간'],[7200,'2시간']];

export function manualEmptyStore(){ return {v:1,seq:0,prefs:{preSec:10},presets:MANUAL_PRESETS.map(([sec,label],i)=>({id:'p'+(i+1),label,sec})),timers:[]}; }
// 같은 이름이 있으면 뒤에 번호(음성으로 구분하고, 같은 문구 8초 중복 억제에 걸리지 않게)
export function manualUniqueLabel(label,timers,selfId){
  const taken=new Set(timers.filter(t=>t.id!==selfId).map(t=>t.label));
  if(!taken.has(label)) return label;
  for(let n=2;;n++){ const c=`${label} ${n}`; if(!taken.has(c)) return c; }
}
export function manualNew(store,kind,label,phases,preSec){
  store.seq=(store.seq||0)+1;
  const ph=phases.map(p=>({name:p.name,sec:p.sec}));
  return {id:'m'+store.seq,label:manualUniqueLabel(label,store.timers||[]),kind,phases:ph,idx:0,cycles:0,status:'idle',endAt:null,
    remainMs:ph[0].sec*1000,preSec,preDone:false,preHeard:false,doneAt:null};
}
export const phaseMs=(t,i)=>t.phases[i].sec*1000;
export function manualRemainMs(t,now){
  if(t.status==='running') return Math.max(0,t.endAt-now);
  if(t.status==='done') return 0;
  return Math.max(0,t.remainMs);
}
export function manualStart(t,now){
  if(t.status==='running') return t;
  if(t.status==='done') return {...manualReset(t),status:'running',endAt:now+phaseMs(t,0)};
  return {...t,status:'running',endAt:now+t.remainMs};
}
export function manualPause(t,now){
  if(t.status!=='running') return t;
  return {...t,status:'paused',remainMs:Math.max(0,t.endAt-now),endAt:null};
}
export function manualReset(t){ return {...t,idx:0,cycles:0,status:'idle',endAt:null,remainMs:phaseMs(t,0),preDone:false,preHeard:false,doneAt:null}; }
// 지금 구간의 남은 시간에 더하고 뺀다(구간 전체 길이는 그대로). 미리 알림 창 밖으로 나가면 다시 울릴 수 있게, 창 안으로 들어가면 울리지 않게
export function manualAdjust(t,deltaMs,now){
  if(t.status==='done') return t;
  let o;
  if(t.status==='running') o={...t,endAt:Math.max(now,t.endAt+deltaMs)};
  else o={...t,remainMs:Math.max(0,t.remainMs+deltaMs)};
  const rem=manualRemainMs(o,now);
  if(rem>o.preSec*1000) return {...o,preDone:false,preHeard:false};
  if(!o.preDone) return {...o,preDone:true};
  return o;
}
/* 한 번의 판정. audible: 지금 소리가 실제로 날 수 있는지(오디오가 running). 미리 알림을 들었는지(preHeard)에 쓴다.
   events: [{type:'pre'|'end'|'switch', idx, slot:'pre'|'end'|'next1'|'next2', late, lateMs, silent}]
   - 정책(사용자 결정): 그 주기에 미리 알림이 들렸으면(preHeard) 끝·전환은 silent(화면만 바뀜)
   - 늦음: 마지막으로 지난 경계에서 15초 넘게 지났으면 late(소리 없이 따라잡음). 경계를 여럿 지나도 이벤트는 하나 */
export function manualStep(t,now,audible=true){
  if(t.status!=='running') return {t,events:[]};
  if(now>=t.endAt){
    if(t.kind!=='routine'){
      const lateMs=now-t.endAt;
      return {t:{...t,status:'done',endAt:null,remainMs:0,doneAt:t.endAt,preDone:false,preHeard:false},
        events:[{type:'end',idx:0,slot:'end',late:lateMs>MANUAL_LATE_MS,lateMs,silent:t.preHeard}]};
    }
    let e=t.endAt, idx=t.idx, cycles=t.cycles, n=0, last=e;
    while(now>=e){ last=e; idx=(idx+1)%t.phases.length; if(idx===0) cycles++; e+=phaseMs(t,idx); n++; }
    const lateMs=now-last;
    return {t:{...t,idx,cycles,endAt:e,preDone:false,preHeard:false},
      events:[{type:'switch',idx,slot:idx===1?'next1':'next2',late:lateMs>MANUAL_LATE_MS,lateMs,silent:n===1&&t.preHeard}]};
  }
  if(t.preDone) return {t,events:[]};
  const rem=t.endAt-now, preMs=t.preSec*1000;
  if(t.preSec<=0||phaseMs(t,t.idx)<=preMs+MANUAL_PRE_SKIP_MS) return {t:{...t,preDone:true},events:[]};   // 시작하자마자 창 안이면 울리지 않는다
  if(rem>preMs) return {t,events:[]};
  if(rem<preMs-MANUAL_PRE_SKIP_MS) return {t:{...t,preDone:true},events:[]};                                // 틱이 늦어 이미 몇 초 지났으면 건너뛴다
  return {t:{...t,preDone:true,preHeard:!!audible},events:[{type:'pre',idx:t.idx,slot:'pre',late:false,lateMs:0,silent:false}]};
}
// 올림해서 m:ss, 1시간 이상은 h:mm:ss
export function manualFmt(ms){
  const s=Math.max(0,Math.ceil(ms/1000)), h=Math.floor(s/3600), m=Math.floor(s%3600/60), x=String(s%60).padStart(2,'0');
  return h?`${h}:${String(m).padStart(2,'0')}:${x}`:`${m}:${x}`;
}
// 초를 "5분"·"1시간"처럼. 분·시간으로 떨어지지 않으면 분:초
export const durLabel=sec=>sec%3600===0?`${sec/3600}시간`:sec%60===0?`${sec/60}분`:manualFmt(sec*1000);
// 프리셋으로 시작한 타이머 이름: 이름이 시간 표기와 같으면 "5분 타이머", 직접 지은 이름이면 그대로
export const presetTimerName=p=>p.label===durLabel(p.sec)?`${p.label} 타이머`:p.label;

/* ----- 저장값 읽기·내보내기·불러오기 ----- */
export const MANUAL_SEC_MAX=24*3600;
export const cleanText=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export const intIn=(v,lo,hi,def)=>{ const n=Math.round(+v); return Number.isFinite(n)?Math.min(hi,Math.max(lo,n)):def; };
export const finite=v=>typeof v==='number'&&Number.isFinite(v);
// 타이머 하나를 검사·보정한다. 형식이 맞지 않으면 null(버림). keepRuntime=false면 실행 상태를 버리고 대기로
export function manualNormalizeTimer(raw,keepRuntime){
  if(!raw||typeof raw!=='object'||!/^m\d+$/.test(String(raw.id))) return null;
  const kind=raw.kind, need=kind==='countdown'?1:kind==='routine'?2:0;
  if(!need||!Array.isArray(raw.phases)||raw.phases.length!==need) return null;
  const phases=[];
  for(const p of raw.phases){
    if(!p||typeof p!=='object'||!Number.isFinite(+p.sec)) return null;
    phases.push({name:cleanText(p.name,MANUAL_LABEL_MAX)||(need===1?'타이머':'구간'),sec:intIn(p.sec,MANUAL_MIN_SEC,MANUAL_SEC_MAX,MANUAL_MIN_SEC)});
  }
  const base={id:String(raw.id),label:cleanText(raw.label,MANUAL_LABEL_MAX)||phases[0].name,kind,phases,preSec:intIn(raw.preSec,0,MANUAL_PRE_MAX,10)};
  const idle=manualReset(base);
  if(!keepRuntime) return idle;
  const status=['idle','running','paused','done'].includes(raw.status)?raw.status:'idle';
  if(status==='running'&&!finite(raw.endAt)) return idle;                  // 끝 시각을 모르면 이어 갈 수 없다
  const t={...idle,status,idx:intIn(raw.idx,0,phases.length-1,0),cycles:intIn(raw.cycles,0,1e9,0),preDone:raw.preDone===true,preHeard:raw.preHeard===true,
    doneAt:finite(raw.doneAt)?raw.doneAt:null};
  if(status==='running') t.endAt=raw.endAt;
  else if(status==='done') t.remainMs=0;
  else t.remainMs=finite(raw.remainMs)&&raw.remainMs>=0?raw.remainMs:phaseMs(t,t.idx);
  return t;
}
export function manualNormalizeStore(raw,keepRuntime){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.v!==1||!Array.isArray(raw.timers)) return null;
  const s=manualEmptyStore(), seen=new Set(); let maxM=0;
  s.prefs.preSec=intIn(raw.prefs&&raw.prefs.preSec,0,MANUAL_PRE_MAX,10);
  if(Array.isArray(raw.presets)) s.presets=raw.presets.filter(p=>p&&typeof p.id==='string'&&cleanText(p.label,MANUAL_LABEL_MAX)&&Number.isFinite(+p.sec))
    .slice(0,20).map(p=>({id:p.id,label:cleanText(p.label,MANUAL_LABEL_MAX),sec:intIn(p.sec,MANUAL_MIN_SEC,MANUAL_SEC_MAX,MANUAL_MIN_SEC)}));
  for(const r of raw.timers){
    const m=r&&/^m(\d+)$/.exec(String(r.id)); if(m) maxM=Math.max(maxM,+m[1]);
    const t=manualNormalizeTimer(r,keepRuntime); if(!t||seen.has(t.id)||s.timers.length>=MANUAL_MAX) continue;
    seen.add(t.id); s.timers.push(t);
  }
  s.seq=Math.max(intIn(raw.seq,0,1e9,0),maxM);
  return s;
}
// localStorage 원문을 읽는다. 없으면 기본, 깨졌으면 빈 저장소와 ok:false(상태줄에 알림)
export function manualLoad(raw){
  if(raw==null) return {store:manualEmptyStore(),ok:true};
  let o; try{ o=JSON.parse(raw); }catch(e){ return {store:manualEmptyStore(),ok:false}; }
  const s=manualNormalizeStore(o,true);
  return s?{store:s,ok:true}:{store:manualEmptyStore(),ok:false};
}
// 백업(묶음 5)용: 정의만. 오래된 끝 시각이 되살아나지 않게 실행 상태는 뺀다
export function manualExport(store){
  return {v:1,seq:store.seq,prefs:{...store.prefs},presets:store.presets.map(p=>({...p})),
    timers:store.timers.map(t=>({id:t.id,label:t.label,kind:t.kind,phases:t.phases.map(p=>({...p})),preSec:t.preSec}))};
}
export function manualImport(x){
  let o=x; if(typeof x==='string'){ try{ o=JSON.parse(x); }catch(e){ return {store:manualEmptyStore(),ok:false}; } }
  const s=manualNormalizeStore(o,false);
  return s?{store:s,ok:true}:{store:manualEmptyStore(),ok:false};
}

/* ----- 문구 (스펙 4.5. 해요체, 음성으로 읽힌다) ----- */
export function manualText(t,ev,timers){
  if(t.kind!=='routine') return ev.type==='pre'?`${t.label} ${t.preSec}초 전`:`${t.label} 끝났어요`;
  const prefix=(timers||[]).filter(x=>x.kind==='routine').length>=2?`${t.label}, `:'';   // 루틴이 둘 이상이면 어느 루틴인지
  if(ev.type==='pre') return `${prefix}${t.phases[(ev.idx+1)%t.phases.length].name} ${t.preSec}초 전`;
  return `${prefix}${t.phases[ev.idx].name} 시간이에요`;
}
