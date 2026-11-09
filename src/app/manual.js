/* ===== 수동 타이머의 엔진 쪽 (묶음 2): 저장, 만들기·조작, 틱. 순수 계산은 core/manual-core.js, 화면은 ui/ManualPanel.jsx.
   manualInit()은 boot()가 부팅 때, manualTick(now)은 Worker 메시지마다 감지 tick()보다 먼저 동기로 부른다 ===== */
import {Alerts,actx,titleTimer,unlockAudio} from './alerts.js';
import {bump} from './bus.js';
import {importing} from './prefs.js';
import {baseTitle,setNote,setTitlePrefix,titlePrefix} from './ui-watch.js';
import {MANUAL_LABEL_MAX,MANUAL_MAX,MANUAL_MIN_SEC,MANUAL_PRE_MAX,MANUAL_STORE,manualAdjust,manualEmptyStore,manualFmt,manualLoad,manualNew,manualRemainMs,manualReset,manualStart,manualStep,manualText} from '../core/manual-core.js';
import {clampInt,parseDur} from '../core/util.js';
export let manual=manualEmptyStore();
export const manualDelArm={};                                       // 실행 중 삭제: 두 번 눌러야 지운다(id → 타이머)
export const manualAudible=()=>!!actx&&actx.state==='running';     // 지금 소리가 실제로 나는지(미리 알림을 '들었는지' 판정)
export function manualSave(){ if(importing) return; try{ localStorage.setItem(MANUAL_STORE,JSON.stringify(manual)); }catch(e){} }   // 실패하면 이 탭에서만 유지
export const manualCurName=t=>t.kind==='routine'?t.phases[t.idx].name:t.label;
export const durLabel=sec=>sec%3600===0?`${sec/3600}시간`:sec%60===0?`${sec/60}분`:manualFmt(sec*1000);
export const manualById=id=>manual.timers.find(t=>t.id===id);
export function manualSet(t){ manual.timers=manual.timers.map(x=>x.id===t.id?t:x); }
export const manualFull=()=>manual.timers.length>=MANUAL_MAX;
const FULL_NOTE=`타이머는 ${MANUAL_MAX}개까지 만들 수 있어요`;
// 창 안의 안내 한 줄(#manualNote). 가득 찼다는 안내는 목록이 바뀔 때 맞춘다
export const manualMsg={text:''};
export function manualNote(text){ manualMsg.text=text; bump(); }
// 목록이 바뀐 뒤: 저장된 상태를 화면에 맞추고 "가득 참" 안내를 넣거나 뺀다
function listChanged(){
  if(manualFull()) manualMsg.text=FULL_NOTE; else if(manualMsg.text.startsWith('타이머는')) manualMsg.text='';
  bump();
}
// 새로고침 뒤에는 오디오가 잠겨 있다. 첫 조작에서 켜고, 그 전에는 상태줄에 "소리가 꺼져 있어요"를 둔다(스펙 17-3)
export function manualWake(){ unlockAudio(); manualTick(Date.now()); }

export function manualInit(){
  let raw=null; try{ raw=localStorage.getItem(MANUAL_STORE); }catch(e){}
  const r=manualLoad(raw); manual=r.store;
  if(!r.ok) setNote('수동 타이머 저장값을 읽지 못했어요');
  document.addEventListener('pointerdown',manualWake,{once:true,capture:true});
  document.addEventListener('keydown',manualWake,{once:true,capture:true});
  listChanged(); manualTick(Date.now());
}
// 새로 만드는 타이머에 쓸 미리 알림 초. 범위 밖이면 잘라서 돌려준다
export function manualSetPre(raw){ manual.prefs.preSec=clampInt(raw,0,MANUAL_PRE_MAX,10); manualSave(); bump(); return manual.prefs.preSec; }
export function manualClearDone(){ manual.timers=manual.timers.filter(t=>t.status!=='done'); manualSave(); listChanged(); }

/* ----- 만들기 ----- */
function manualCanAdd(){
  if(!manualFull()) return true;
  manualNote(FULL_NOTE); return false;
}
export function manualAddAndStart(kind,label,phases){
  unlockAudio();                                             // 오디오는 사용자 조작으로만 켜진다
  if(!manualCanAdd()) return;
  const t=manualStart(manualNew(manual,kind,label,phases,manual.prefs.preSec),Date.now());
  manual.timers.push(t); manualSave(); manualMsg.text=''; listChanged(); manualTick(Date.now());
}
// 분:초 입력을 초로. 숫자만 쓰면 분(기존 지속시간 칸과 같은 규칙). 잘못되면 null과 이유
export function manualReadDur(raw){
  const v=parseDur(raw);
  if(!v) return {sec:null,msg:'시간을 분:초로 입력해 주세요 (예: 30:00)'};
  if(v<MANUAL_MIN_SEC) return {sec:null,msg:`${MANUAL_MIN_SEC}초 이상으로 입력해 주세요`};
  return {sec:v,msg:''};
}
export function manualCreateCountdown(nameRaw,durRaw){
  const d=manualReadDur(durRaw); if(!d.sec){ manualNote(d.msg); return; }
  const name=String(nameRaw).trim().slice(0,MANUAL_LABEL_MAX)||`${durLabel(d.sec)} 타이머`;
  manualAddAndStart('countdown',name,[{name,sec:d.sec}]);
}
// v={n1,d1,n2,d2}: 구간 이름과 길이 입력값
export function manualCreateRoutine(v){
  const ph=[];
  for(const i of [1,2]){
    const d=manualReadDur(v['d'+i]); if(!d.sec){ manualNote(`구간 ${i}: ${d.msg}`); return; }
    ph.push({name:String(v['n'+i]).trim().slice(0,MANUAL_LABEL_MAX)||(i===1?'사냥':'회수'),sec:d.sec});
  }
  manualAddAndStart('routine',`${ph[0].name}·${ph[1].name}`,ph);
}
export function manualSavePreset(nameRaw,durRaw){
  const d=manualReadDur(durRaw); if(!d.sec){ manualNote(d.msg); return; }
  const label=String(nameRaw).trim().slice(0,MANUAL_LABEL_MAX)||durLabel(d.sec);
  if(manual.presets.some(p=>p.label===label)){ manualNote(`“${label}” 프리셋이 이미 있어요`); return; }
  if(manual.presets.length>=20){ manualNote('프리셋은 20개까지 저장할 수 있어요'); return; }
  const n=Math.max(0,...manual.presets.map(p=>+(/^p(\d+)$/.exec(p.id)||[0,0])[1]))+1;
  manual.presets.push({id:'p'+n,label,sec:d.sec}); manualSave(); manualNote(`“${label}” 프리셋을 저장했어요`);
}
// 프리셋 칩: 한 번 누르면 바로 시작. 시간만 있는 프리셋은 "5분 타이머", 이름 붙인 프리셋은 그 이름
export function manualStartPreset(p){ const name=p.label===durLabel(p.sec)?`${p.label} 타이머`:p.label; manualAddAndStart('countdown',name,[{name,sec:p.sec}]); }
export function manualDeletePreset(p){ manual.presets=manual.presets.filter(x=>x!==p); manualSave(); bump(); }

/* ----- 카드 조작 ----- */
export function manualAct(t,fn){ manualSet(fn(manualById(t.id)||t)); manualSave(); listChanged(); manualTick(Date.now()); }
export function manualDelete(id){
  const t=manualById(id); if(!t) return;
  if(t.status==='running'&&!manualDelArm[id]){                 // 실행 중이면 3초 안에 한 번 더 눌러야 지운다
    manualDelArm[id]=setTimeout(()=>{ delete manualDelArm[id]; bump(); },3000); bump(); return;
  }
  clearTimeout(manualDelArm[id]); delete manualDelArm[id];
  manual.timers=manual.timers.filter(x=>x.id!==id); manualSave(); listChanged(); manualTick(Date.now());
}
// 고치기: 이름·미리 알림은 언제든, 길이는 실행 중이 아닐 때만. 길이를 바꾸면 처음부터(대기)로 돌아간다.
// v={label, preSec, phases:[{name|null, dur}]}. 잘못되면 이유 문구를 돌려주고 바꾸지 않는다
export function manualSaveEdit(id,v){
  const cur=manualById(id); if(!cur) return '';
  const label=String(v.label).trim().slice(0,MANUAL_LABEL_MAX);
  if(!label||manual.timers.some(x=>x.id!==cur.id&&x.label===label)) return '이름을 비우거나 다른 타이머와 같게 할 수 없어요';
  let next={...cur,label,preSec:Math.max(0,Math.min(MANUAL_PRE_MAX,Math.round(+v.preSec)||0))};
  if(cur.status!=='running'){
    const phases=[];
    for(const [i,x] of v.phases.entries()){ const d=manualReadDur(x.dur); if(!d.sec) return d.msg;
      phases.push({name:x.name!=null?(String(x.name).trim().slice(0,MANUAL_LABEL_MAX)||cur.phases[i].name):label,sec:d.sec}); }
    if(JSON.stringify(phases)!==JSON.stringify(cur.phases)) next=manualReset({...next,phases});
  }
  manualSet(manualAdjust(next,0,Date.now())); manualSave(); listChanged(); manualTick(Date.now());
  return null;
}

/* ----- 카드 표시 문구 ----- */
// 남은 시간 칸·구간·설명·게이지
export function manualView(t,now){
  if(t.status==='done'){
    const ago=Math.max(0,Math.floor((now-(t.doneAt||now))/60000));
    return {time:'끝났어요',info:ago?`${ago}분 전에 끝났어요`:'방금 끝났어요',phase:'',gauge:null};
  }
  const rem=manualRemainMs(t,now), total=t.phases[t.idx].sec*1000;
  const pre=t.preSec?`${t.preSec}초 전 알림`:'미리 알림 없음';
  const kind=t.kind==='routine'?`${t.phases[0].name} ${durLabel(t.phases[0].sec)} ↔ ${t.phases[1].name} ${durLabel(t.phases[1].sec)}`:'카운트다운';
  return {time:manualFmt(rem),
    gauge:total>0?{frac:Math.max(0,Math.min(1,rem/total)),low:t.status==='running'&&!!t.preSec&&rem<=t.preSec*1000}:null,
    info:(t.status==='paused'?'멈춤 · ':t.status==='idle'?'대기 · ':'')+`${kind} · ${pre}`,
    phase:t.kind==='routine'?`${t.phases[t.idx].name} · ${t.cycles+1}바퀴째`:''};
}

/* ----- 틱: 판정 → 알림 → 저장 → 상태줄·탭 제목 ----- */
export const MANUAL_BEEP={pre:'timer',end:'gone',next1:'gone',next2:'gone'};
export function manualTick(now){
  const audible=manualAudible(), late=[]; let changed=false;
  manual.timers=manual.timers.map(t=>{
    if(t.status!=='running') return t;
    const r=manualStep(t,now,audible);
    if(r.t===t) return t;
    changed=true;
    for(const ev of r.events){
      if(ev.late){ late.push(t.label); continue; }   // 자리를 비운 사이 지난 것: 소리 없이 따라잡고 안내만
      if(ev.silent) continue;                         // 미리 알림을 들은 주기의 끝·전환은 화면만(정책)
      Alerts.fire({src:'manual',id:t.id,event:ev.slot,text:manualText(r.t,ev,manual.timers),beep:MANUAL_BEEP[ev.slot],slot:'manual.'+ev.slot,mode:'full',group:null,flash:'manual-'+t.id});
    }
    return r.t;
  });
  if(changed) manualSave();
  if(late.length) setNote(`자리를 비운 사이 지난 알림이 있어요: ${late.join(', ')}`,'info');
  // 탭 제목 접두는 숨겨져 있어도 바로 바꾼다. 알림 깜빡임 중이면 끝난 뒤 baseTitle()이 반영
  const prefix=manualTitlePrefix(now);
  if(prefix!==titlePrefix){ setTitlePrefix(prefix); if(titleTimer===null) document.title=baseTitle(); }
  bump();
}
const runningByRemain=now=>manual.timers.filter(t=>t.status==='running').sort((a,b)=>manualRemainMs(a,now)-manualRemainMs(b,now));
function manualTitlePrefix(now){ const run=runningByRemain(now); return run.length?`⏱ ${manualFmt(manualRemainMs(run[0],now))}`:''; }
// 상태줄(#watchManual)의 수동 타이머 요약. 남은 시간이 짧은 실행 중 타이머 두 개 + 멈춘 것
export function manualStripText(now){
  const items=[...runningByRemain(now).map(t=>`${manualCurName(t)} ${manualFmt(manualRemainMs(t,now))}`),
               ...manual.timers.filter(t=>t.status==='paused').map(t=>`${manualCurName(t)} ${manualFmt(t.remainMs)} (멈춤)`)];
  return items.length?'⏱ '+items.slice(0,2).join(' · ')+(items.length>2?` +${items.length-2}`:''):'';
}
// 실행 중인 타이머가 있는데 소리가 아직 잠겨 있으면 상태줄에 "소리가 꺼져 있어요"
export const soundLocked=()=>manual.timers.some(t=>t.status==='running')&&!manualAudible();
// 소리 설정의 "듣기": 실제 타이머가 있으면 그 이름으로, 없으면 예시 문구
export function manualPreviewText(ev){
  const c=manual.timers.find(t=>t.kind==='countdown'), r=manual.timers.find(t=>t.kind==='routine');
  if(ev==='pre') return c?manualText(c,{type:'pre',idx:0},manual.timers):'10분 타이머 10초 전';
  if(ev==='end') return c?manualText(c,{type:'end',idx:0},manual.timers):'10분 타이머 끝났어요';
  const idx=ev==='next1'?1:0;
  return r?manualText(r,{type:'switch',idx},manual.timers):(idx?'회수 시간이에요':'사냥 시간이에요');
}
