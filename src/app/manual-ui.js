/* ===== 수동 타이머 화면과 틱 (묶음 2). 순수 계산은 manual-core.js.
   manualInit()은 main.js가 부팅 때, manualTick(now)은 Worker 메시지마다 감지 tick()보다 먼저 동기로 부른다 ===== */
import {Alerts,actx,titleTimer,unlockAudio} from './alerts.js';
import {$} from './dom.js';
import {importing} from './prefs.js';
import {setGauge,setText} from './ui-cards.js';
import {baseTitle,setNote,setTitlePrefix,titlePrefix} from './ui-watch.js';
import {MANUAL_LABEL_MAX,MANUAL_MAX,MANUAL_MIN_SEC,MANUAL_PRE_MAX,MANUAL_STORE,manualAdjust,manualEmptyStore,manualFmt,manualLoad,manualNew,manualPause,manualRemainMs,manualReset,manualStart,manualStep,manualText} from '../core/manual-core.js';
import {clampInt,parseDur} from '../core/util.js';
export let manual=manualEmptyStore();
export const manualDelArm={};                                       // 실행 중 삭제: 두 번 눌러야 지운다(id → 타이머)
export const manualAudible=()=>!!actx&&actx.state==='running';     // 지금 소리가 실제로 나는지(미리 알림을 '들었는지' 판정)
export function manualSave(){ if(importing) return; try{ localStorage.setItem(MANUAL_STORE,JSON.stringify(manual)); }catch(e){} }   // 실패하면 이 탭에서만 유지
export const manualCurName=t=>t.kind==='routine'?t.phases[t.idx].name:t.label;
export const durLabel=sec=>sec%3600===0?`${sec/3600}시간`:sec%60===0?`${sec/60}분`:manualFmt(sec*1000);
export const manualById=id=>manual.timers.find(t=>t.id===id);
export function manualSet(t){ manual.timers=manual.timers.map(x=>x.id===t.id?t:x); }
export function manualNote(text){ setText($('#manualNote'),text); }

export function manualInit(){
  let raw=null; try{ raw=localStorage.getItem(MANUAL_STORE); }catch(e){}
  const r=manualLoad(raw); manual=r.store;
  if(!r.ok) setNote('수동 타이머 저장값을 읽지 못했어요');
  $('#manualPre').value=manual.prefs.preSec;
  $('#manualPre').onchange=()=>{ manual.prefs.preSec=clampInt($('#manualPre').value,0,MANUAL_PRE_MAX,10); $('#manualPre').value=manual.prefs.preSec; manualSave(); };   // 새로 만드는 타이머에 쓴다
  $('#manualForm').onsubmit=e=>{ e.preventDefault(); manualCreateFromForm(); };
  $('#manualSavePreset').onclick=manualSavePreset;
  $('#manualRoutine').onsubmit=e=>{ e.preventDefault(); manualCreateRoutine(); };
  $('#manualClearDone').onclick=()=>{ manual.timers=manual.timers.filter(t=>t.status!=='done'); manualSave(); renderManualList(); };
  // 새로고침 뒤에는 오디오가 잠겨 있다. 첫 조작에서 켜고, 그 전에는 상태줄에 "소리가 꺼져 있어요"를 둔다(스펙 17-3)
  const wake=()=>{ unlockAudio(); manualTick(Date.now()); };
  document.addEventListener('pointerdown',wake,{once:true,capture:true});
  document.addEventListener('keydown',wake,{once:true,capture:true});
  $('#soundLockBtn').onclick=wake;
  renderManualPresets(); renderManualList(); manualTick(Date.now());
}

/* ----- 만들기 ----- */
export function manualCanAdd(){
  if(manual.timers.length<MANUAL_MAX) return true;
  manualNote(`타이머는 ${MANUAL_MAX}개까지 만들 수 있어요`); return false;
}
export function manualAddAndStart(kind,label,phases){
  unlockAudio();                                             // 오디오는 사용자 조작으로만 켜진다
  if(!manualCanAdd()) return;
  const t=manualStart(manualNew(manual,kind,label,phases,manual.prefs.preSec),Date.now());
  manual.timers.push(t); manualSave(); manualNote(''); renderManualList(); manualTick(Date.now());
}
// 분:초 입력을 초로. 숫자만 쓰면 분(기존 지속시간 칸과 같은 규칙). 잘못되면 null과 이유
export function manualReadDur(raw){
  const v=parseDur(raw);
  if(!v) return {sec:null,msg:'시간을 분:초로 입력해 주세요 (예: 30:00)'};
  if(v<MANUAL_MIN_SEC) return {sec:null,msg:`${MANUAL_MIN_SEC}초 이상으로 입력해 주세요`};
  return {sec:v,msg:''};
}
export function manualCreateFromForm(){
  const d=manualReadDur($('#manualDur').value); if(!d.sec){ manualNote(d.msg); return; }
  const name=$('#manualName').value.trim().slice(0,MANUAL_LABEL_MAX)||`${durLabel(d.sec)} 타이머`;
  manualAddAndStart('countdown',name,[{name,sec:d.sec}]);
}
export function manualCreateRoutine(){
  const f=$('#manualRoutine'), ph=[];
  for(const i of [1,2]){
    const d=manualReadDur(f.elements['d'+i].value); if(!d.sec){ manualNote(`구간 ${i}: ${d.msg}`); return; }
    ph.push({name:f.elements['n'+i].value.trim().slice(0,MANUAL_LABEL_MAX)||(i===1?'사냥':'회수'),sec:d.sec});
  }
  manualAddAndStart('routine',`${ph[0].name}·${ph[1].name}`,ph);
}
export function manualSavePreset(){
  const d=manualReadDur($('#manualDur').value); if(!d.sec){ manualNote(d.msg); return; }
  const label=$('#manualName').value.trim().slice(0,MANUAL_LABEL_MAX)||durLabel(d.sec);
  if(manual.presets.some(p=>p.label===label)){ manualNote(`“${label}” 프리셋이 이미 있어요`); return; }
  if(manual.presets.length>=20){ manualNote('프리셋은 20개까지 저장할 수 있어요'); return; }
  const n=Math.max(0,...manual.presets.map(p=>+(/^p(\d+)$/.exec(p.id)||[0,0])[1]))+1;
  manual.presets.push({id:'p'+n,label,sec:d.sec}); manualSave(); renderManualPresets(); manualNote(`“${label}” 프리셋을 저장했어요`);
}
// 프리셋 칩: 한 번 누르면 바로 시작. 시간만 있는 프리셋은 "5분 타이머", 이름 붙인 프리셋은 그 이름
export function renderManualPresets(){
  const box=$('#manualPresets'); box.textContent='';
  for(const p of manual.presets){
    const b=document.createElement('button'); b.type='button'; b.textContent=p.label; b.title=`${p.label} 타이머 바로 시작`;
    b.onclick=()=>{ const name=p.label===durLabel(p.sec)?`${p.label} 타이머`:p.label; manualAddAndStart('countdown',name,[{name,sec:p.sec}]); };
    box.append(b);
  }
  const add=document.createElement('button'); add.type='button'; add.textContent='+ 내 프리셋';
  add.onclick=()=>{ $('#manualName').focus(); manualNote('이름과 시간을 넣고 “프리셋으로 저장”을 누르세요'); };
  box.append(add);
  const list=$('#manualPresetList'); list.textContent='';
  for(const p of manual.presets){
    const row=document.createElement('div'); row.className='row';
    const s=document.createElement('span'); s.textContent=`${p.label} · ${durLabel(p.sec)}`;
    const del=document.createElement('button'); del.type='button'; del.textContent='지우기'; del.setAttribute('aria-label',`${p.label} 프리셋 지우기`);
    del.onclick=()=>{ manual.presets=manual.presets.filter(x=>x!==p); manualSave(); renderManualPresets(); };
    row.append(s,del); list.append(row);
  }
}

/* ----- 카드 ----- */
export function renderManualList(){
  const box=$('#manualList'); box.textContent='';
  for(const t of manual.timers) box.append(buildManualCard(t));
  const full=manual.timers.length>=MANUAL_MAX;
  for(const b of document.querySelectorAll('#manualPresets button, #manualForm button.primary, #manualRoutine button')) b.disabled=full;
  if(full) manualNote(`타이머는 ${MANUAL_MAX}개까지 만들 수 있어요`); else if($('#manualNote').textContent.startsWith('타이머는')) manualNote('');
  $('#manualClearDone').hidden=!manual.timers.some(t=>t.status==='done');
  renderManualTimes(Date.now());
}
export function mkBtn(text,fn,label){ const b=document.createElement('button'); b.type='button'; b.textContent=text; b.onclick=fn; if(label) b.setAttribute('aria-label',label); return b; }
export function manualAct(t,fn){ manualSet(fn(manualById(t.id)||t)); manualSave(); renderManualList(); manualTick(Date.now()); }
export function buildManualCard(t){
  const el=document.createElement('div'); el.className='card mt'; el.id='manual-'+t.id;
  const head=document.createElement('div'); head.className='mt-head';
  const name=document.createElement('b'); name.textContent=t.label; head.append(name);
  const phase=document.createElement('span'); phase.className='sub'; phase.dataset.s='phase'; head.append(phase);
  const time=document.createElement('div'); time.className='mt-time'; time.dataset.s='time';
  const gauge=document.createElement('div'); gauge.className='gauge'; gauge.dataset.s='gauge'; gauge.setAttribute('aria-hidden','true'); gauge.hidden=true; gauge.append(document.createElement('i'));
  const info=document.createElement('div'); info.className='sub'; info.dataset.s='info';
  const btns=document.createElement('div'); btns.className='row mt-btns';
  const now=Date.now();
  if(t.status==='done'){
    btns.append(mkBtn('다시 시작',()=>{ unlockAudio(); manualAct(t,x=>manualStart(x,Date.now())); }));
  } else {
    btns.append(mkBtn(t.status==='running'?'일시정지':(t.status==='paused'?'계속':'시작'),()=>{ unlockAudio(); manualAct(t,x=>x.status==='running'?manualPause(x,Date.now()):manualStart(x,Date.now())); }));
    btns.append(mkBtn('처음부터',()=>manualAct(t,manualReset)));
    for(const [txt,ms,lb] of [['-1분',-60000,'1분 빼기'],['-10초',-10000,'10초 빼기'],['+10초',10000,'10초 더하기'],['+1분',60000,'1분 더하기']])
      btns.append(mkBtn(txt,()=>manualAct(t,x=>manualAdjust(x,ms,Date.now())),`${t.label} ${lb}`));
  }
  const del=mkBtn(manualDelArm[t.id]?'정말 지울까요?':'삭제',()=>manualDelete(t.id),`${t.label} 삭제`); del.classList.add('mt-del'); btns.append(del);
  const edit=mkBtn('고치기',()=>{ form.hidden=!form.hidden; if(!form.hidden) form.querySelector('input').focus(); },`${t.label} 고치기`); head.append(edit);
  const form=buildManualEdit(t);
  el.append(head,time,gauge,info,btns,form);
  return el;
}
export function manualDelete(id){
  const t=manualById(id); if(!t) return;
  const btn=()=>document.querySelector(`#manual-${id} .mt-del`);   // 그 사이 카드가 다시 그려질 수 있어 매번 찾는다
  if(t.status==='running'&&!manualDelArm[id]){                 // 실행 중이면 3초 안에 한 번 더 눌러야 지운다
    btn().textContent='정말 지울까요?'; manualDelArm[id]=setTimeout(()=>{ delete manualDelArm[id]; const b=btn(); if(b) b.textContent='삭제'; },3000); return;
  }
  clearTimeout(manualDelArm[id]); delete manualDelArm[id];
  manual.timers=manual.timers.filter(x=>x.id!==id); manualSave(); renderManualList(); manualTick(Date.now());
}
// 고치기: 이름·미리 알림은 언제든, 길이는 실행 중이 아닐 때만. 길이를 바꾸면 처음부터(대기)로 돌아간다
export function buildManualEdit(t){
  const f=document.createElement('form'); f.className='grid mt-edit'; f.hidden=true;
  const field=(label,input)=>{ const l=document.createElement('label'); l.textContent=label; const s=document.createElement('span'); s.append(input); f.append(l,s); return input; };
  const inp=(v,attrs)=>{ const i=document.createElement('input'); i.value=v; Object.assign(i,attrs||{}); return i; };
  const nameI=field('이름',inp(t.label,{maxLength:MANUAL_LABEL_MAX}));
  const durI=t.phases.map((p,i)=>{
    const lab=t.kind==='routine'?`구간 ${i+1}`:'시간';
    const nI=t.kind==='routine'?inp(p.name,{maxLength:MANUAL_LABEL_MAX}):null, dI=inp(manualFmt(p.sec*1000),{size:7});
    dI.disabled=t.status==='running'; dI.setAttribute('aria-label',`${lab} 길이(분:초)`);
    const wrap=document.createElement('span'); if(nI){ nI.setAttribute('aria-label',`${lab} 이름`); wrap.append(nI,' '); } wrap.append(dI);
    const l=document.createElement('label'); l.textContent=lab; f.append(l,wrap); return {nI,dI};
  });
  const preI=field('미리 알림',inp(t.preSec,{type:'number',min:0,max:MANUAL_PRE_MAX}));
  const err=document.createElement('span'); err.className='sub'; err.setAttribute('role','alert');
  const save=document.createElement('button'); save.textContent='저장';
  const sp=document.createElement('span'); f.append(sp); const act=document.createElement('span'); act.className='row'; act.append(save,err); f.append(act);
  f.onsubmit=e=>{
    e.preventDefault(); const cur=manualById(t.id); if(!cur) return;
    const label=nameI.value.trim().slice(0,MANUAL_LABEL_MAX);
    if(!label||manual.timers.some(x=>x.id!==cur.id&&x.label===label)){ err.textContent='이름을 비우거나 다른 타이머와 같게 할 수 없어요'; return; }
    let next={...cur,label,preSec:Math.max(0,Math.min(MANUAL_PRE_MAX,Math.round(+preI.value)||0))};
    if(cur.status!=='running'){
      const phases=[];
      for(const [i,x] of durI.entries()){ const d=manualReadDur(x.dI.value); if(!d.sec){ err.textContent=d.msg; return; }
        phases.push({name:x.nI?(x.nI.value.trim().slice(0,MANUAL_LABEL_MAX)||cur.phases[i].name):label,sec:d.sec}); }
      if(JSON.stringify(phases)!==JSON.stringify(cur.phases)) next=manualReset({...next,phases});
    }
    manualSet(manualAdjust(next,0,Date.now())); manualSave(); renderManualList(); manualTick(Date.now());
  };
  return f;
}
// 남은 시간 표시(매 틱, 바뀔 때만 DOM을 건드린다)
export function renderManualTimes(now){
  for(const t of manual.timers){
    const el=document.getElementById('manual-'+t.id); if(!el) continue;
    const q=s=>el.querySelector(`[data-s=${s}]`);
    if(t.status==='done'){
      setText(q('time'),'끝났어요');
      const ago=Math.max(0,Math.floor((now-(t.doneAt||now))/60000));
      setText(q('info'),ago?`${ago}분 전에 끝났어요`:'방금 끝났어요'); setText(q('phase'),''); setGauge(q('gauge'),null); continue;
    }
    const rem=manualRemainMs(t,now), total=t.phases[t.idx].sec*1000;
    setText(q('time'),manualFmt(rem));
    setGauge(q('gauge'),total>0?{frac:Math.max(0,Math.min(1,rem/total)),low:t.status==='running'&&!!t.preSec&&rem<=t.preSec*1000}:null);
    const pre=t.preSec?`${t.preSec}초 전 알림`:'미리 알림 없음';
    const kind=t.kind==='routine'?`${t.phases[0].name} ${durLabel(t.phases[0].sec)} ↔ ${t.phases[1].name} ${durLabel(t.phases[1].sec)}`:'카운트다운';
    setText(q('info'),(t.status==='paused'?'멈춤 · ':t.status==='idle'?'대기 · ':'')+`${kind} · ${pre}`);
    setText(q('phase'),t.kind==='routine'?`${t.phases[t.idx].name} · ${t.cycles+1}바퀴째`:'');
  }
}

/* ----- 틱: 판정 → 알림 → 저장 → 상태줄·탭 제목 ----- */
export const MANUAL_BEEP={pre:'timer',end:'gone',next1:'gone',next2:'gone'};
export function manualTick(now){
  const audible=manualAudible(), late=[]; let changed=false, rebuild=false;
  manual.timers=manual.timers.map(t=>{
    if(t.status!=='running') return t;
    const r=manualStep(t,now,audible);
    if(r.t===t) return t;
    changed=true; if(r.t.status!==t.status||r.t.idx!==t.idx) rebuild=true;
    for(const ev of r.events){
      if(ev.late){ late.push(t.label); continue; }   // 자리를 비운 사이 지난 것: 소리 없이 따라잡고 안내만
      if(ev.silent) continue;                         // 미리 알림을 들은 주기의 끝·전환은 화면만(정책)
      Alerts.fire({src:'manual',id:t.id,event:ev.slot,text:manualText(r.t,ev,manual.timers),beep:MANUAL_BEEP[ev.slot],slot:'manual.'+ev.slot,mode:'full',group:null,flash:'manual-'+t.id});
    }
    return r.t;
  });
  if(changed) manualSave();
  if(late.length) setNote(`자리를 비운 사이 지난 알림이 있어요: ${late.join(', ')}`,'info');
  if(rebuild) renderManualList(); else if(!document.hidden) renderManualTimes(now);
  renderManualStrip(now);
}
// 상태줄(#watchManual)과 탭 제목 접두. 문자열이 바뀔 때만 쓴다. role=timer라 화면 낭독기가 매번 읽지 않는다
export function renderManualStrip(now){
  const run=manual.timers.filter(t=>t.status==='running').sort((a,b)=>manualRemainMs(a,now)-manualRemainMs(b,now));
  const items=[...run.map(t=>`${manualCurName(t)} ${manualFmt(manualRemainMs(t,now))}`),
               ...manual.timers.filter(t=>t.status==='paused').map(t=>`${manualCurName(t)} ${manualFmt(t.remainMs)} (멈춤)`)];
  setText($('#watchManual'),items.length?'⏱ '+items.slice(0,2).join(' · ')+(items.length>2?` +${items.length-2}`:''):'');
  const prefix=run.length?`⏱ ${manualFmt(manualRemainMs(run[0],now))}`:'';
  if(prefix!==titlePrefix){ setTitlePrefix(prefix); if(titleTimer===null) document.title=baseTitle(); }   // 알림 깜빡임 중이면 끝난 뒤 baseTitle()이 반영
  const lockHidden=!(run.length&&!manualAudible()); if($('#soundLock').hidden!==lockHidden) $('#soundLock').hidden=lockHidden;
}
// 소리 설정의 "듣기": 실제 타이머가 있으면 그 이름으로, 없으면 예시 문구
export function manualPreviewText(ev){
  const c=manual.timers.find(t=>t.kind==='countdown'), r=manual.timers.find(t=>t.kind==='routine');
  if(ev==='pre') return c?manualText(c,{type:'pre',idx:0},manual.timers):'10분 타이머 10초 전';
  if(ev==='end') return c?manualText(c,{type:'end',idx:0},manual.timers):'10분 타이머 끝났어요';
  const idx=ev==='next1'?1:0;
  return r?manualText(r,{type:'switch',idx},manual.timers):(idx?'회수 시간이에요':'사냥 시간이에요');
}
