/* ----- 감시 상태줄 ----- */
import {titleTimer} from './alerts.js';
import {health,src,viewCtx} from './capture.js';
import {states} from './detect-run.js';
import {$} from './dom.js';
import {saveUi,ui} from './prefs.js';
import {startRegister,startRegisterQueue} from './register.js';
import {store,targetById} from './store.js';
import {summarizeStrip,targetSnapshot} from '../core/targets.js';
export function watchStatus(){
  if(src&&src.type==='stream') return health.badWarned ? {cls:'bad',state:'게임 화면이 안 들어와요',title:'⚠ 화면 안 들어옴'} : {cls:'on',state:'감시 중',title:'● 감시 중'};
  if(src) return {cls:'test',state:'스크린샷 테스트 중 · 실제 감시 아님',title:''};
  if(health.lostAt) return {cls:'bad',state:'연결 끊김 · 알림이 멈췄어요',title:'⚠ 연결 끊김'};
  return {cls:'',state:'연결 안 됨 · 감시하지 않아요',title:''};
}
export let titlePrefix='';
export function setTitlePrefix(p){ titlePrefix=p; }   // 묶음 2가 수동 타이머 상태를 탭 제목 앞에 붙이는 자리
export function baseTitle(){ const t=watchStatus().title; return (titlePrefix?titlePrefix+' · ':'')+(t?t+' · ':'')+'메이플 재획 알리미'; }
export let watchKey='', noteTimer;
export function setNote(text, kind='warn'){
  const n=$('#watchNote'); n.textContent=text; n.className='note'+(kind==='info'?' info':'');
  clearTimeout(noteTimer); if(text&&kind==='info') noteTimer=setTimeout(()=>{ n.textContent=''; },8000);
}
// 상태줄과 묶음 5의 PIP가 같은 행을 쓴다. 순수 계산은 targets.js의 targetSnapshot
export const snapshotNow=()=>targetSnapshot(store.targets,states,viewCtx(),Date.now());
export function renderWatch(){
  const w=watchStatus();
  const items=src?summarizeStrip(snapshotNow(),ui.stripOpen):[];     // 연결 안 됨 상태에서는 대상 목록을 보이지 않는다
  const key=w.cls+'|'+w.state+'|'+JSON.stringify(items)+'|'+(src&&src.type);
  if(key!==watchKey){   // 바뀔 때만 다시 그려서 화면 낭독기가 매 틱 읽지 않게 함
    watchKey=key; $('#watch').className='watch '+w.cls; $('#watchState').textContent=w.state;
    const box=$('#watchTargets'); box.textContent='';
    items.forEach((it,i)=>{
      if(i){ const sep=document.createElement('span'); sep.className='sep'; sep.setAttribute('aria-hidden','true'); sep.textContent='·'; box.append(sep); }
      if(it.type==='btn'||it.type==='reregAll'){   // 연결 뒤 다음에 할 일(등록)이 주된 버튼이 되도록 primary로 강조
        const b=document.createElement('button'); b.className='primary'; b.textContent=it.label;
        b.onclick=it.type==='btn'?()=>startRegister(targetById(it.id)):()=>startRegisterQueue(it.ids); box.append(b); }
      else if(it.type==='okGroup'){
        const b=document.createElement('button'); b.textContent=it.label; b.setAttribute('aria-expanded',it.open?'true':'false');
        b.onclick=()=>{ ui.stripOpen=!ui.stripOpen; saveUi(); renderWatch(); }; box.append(b); }
      else { const sp=document.createElement('span'); if(it.cls) sp.className=it.cls; sp.textContent=it.text; box.append(sp); }
    });
    const stop=$('#btnStop'); stop.hidden=!src; stop.textContent=src&&src.type==='image'?'테스트 끝내기':'감시 끝내기';
  }
  if(titleTimer===null){ const bt=baseTitle(); if(document.title!==bt) document.title=bt; }
  const stale=src&&src.type==='stream' ? (Date.now()-health.okAt)/1000 : 0;   // 2초 넘게 확인이 없을 때만 경과 시간 표시
  const beat=stale>2 ? `마지막 확인 ${Math.floor(stale)}초 전` : '';
  if($('#watchBeat').textContent!==beat) $('#watchBeat').textContent=beat;
}
export function pulse(){ const dot=$('#watchDot'); dot.classList.remove('beat'); void dot.offsetWidth; dot.classList.add('beat'); }
