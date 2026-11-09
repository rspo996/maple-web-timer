/* ----- 감시 상태줄의 엔진 쪽: 상태 판정, 안내 문구, 탭 제목. 그리는 것은 ui/WatchBar.jsx ----- */
import {titleTimer} from './alerts.js';
import {bump} from './bus.js';
import {health,src,viewCtx} from './capture.js';
import {states} from './detect-run.js';
import {saveUi,ui} from './prefs.js';
import {store} from './store.js';
import {summarizeStrip,targetSnapshot} from '../core/targets.js';
export function watchStatus(){
  if(src&&src.type==='stream') return health.badWarned ? {cls:'bad',state:'게임 화면이 안 들어와요',title:'⚠ 화면 안 들어옴'} : {cls:'on',state:'감시 중',title:'● 감시 중'};
  if(src) return {cls:'test',state:'스크린샷 테스트 중 · 실제 감시 아님',title:''};
  if(health.lostAt) return {cls:'bad',state:'연결 끊김 · 알림이 멈췄어요',title:'⚠ 연결 끊김'};
  return {cls:'',state:'연결 안 됨 · 감시하지 않아요',title:''};
}
export let titlePrefix='';   // 묶음 2가 수동 타이머 상태를 탭 제목 앞에 붙이는 자리
export function setTitlePrefix(p){ titlePrefix=p; }
export function baseTitle(){ const t=watchStatus().title; return (titlePrefix?titlePrefix+' · ':'')+(t?t+' · ':'')+'메이플 재획 알리미'; }
// 상태줄 안내 한 줄. info는 8초 뒤 저절로 지운다
export const note={text:'',kind:'warn'};
let noteTimer;
export function setNote(text, kind='warn'){
  note.text=text; note.kind=kind; bump();
  clearTimeout(noteTimer); if(text&&kind==='info') noteTimer=setTimeout(()=>{ note.text=''; bump(); },8000);
}
// 상태줄과 묶음 5의 PIP가 같은 행을 쓴다. 순수 계산은 targets.js의 targetSnapshot
export const snapshotNow=()=>targetSnapshot(store.targets,states,viewCtx(),Date.now());
// 연결 안 됨 상태에서는 대상 목록을 보이지 않는다
export const stripItems=()=>src?summarizeStrip(snapshotNow(),ui.stripOpen):[];
export function toggleStripOpen(){ ui.stripOpen=!ui.stripOpen; saveUi(); renderWatch(); }
// 탭 제목은 숨겨져 있어도 바로 바꾸고(사냥 중에 보는 곳), 상태줄은 화면 갱신 신호로 그린다
export function renderWatch(){
  if(titleTimer===null){ const bt=baseTitle(); if(document.title!==bt) document.title=bt; }
  bump();
}
// 2초 넘게 확인이 없을 때만 경과 시간 표시
export function beatText(){
  const stale=src&&src.type==='stream' ? (Date.now()-health.okAt)/1000 : 0;
  return stale>2 ? `마지막 확인 ${Math.floor(stale)}초 전` : '';
}
export function pulse(){ const dot=document.getElementById('watchDot'); if(!dot) return; dot.classList.remove('beat'); void dot.offsetWidth; dot.classList.add('beat'); }
