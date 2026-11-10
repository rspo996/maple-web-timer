import {Alerts,speak,unlockAudio} from './alerts.js';
import {resetAllStates} from './detect-run.js';
import {bump} from './bus.js';
import {saveUi,ui} from './prefs.js';
import {pctx,pv} from './register.js';
import {store} from './store.js';
import {renderWatch,setNote} from './watch.js';
import {KINDS} from '../core/kinds.js';
import {eunNeun} from '../core/util.js';
import {WATCH_START} from '../core/voice-phrases.js';
export const EMPTY_DEFAULT='“게임 화면 연결”을 눌러 메이플스토리 창을 공유하세요.';
export const EMPTY_LOST='화면 연결이 끊겼어요. “게임 화면 연결”을 다시 눌러 주세요.';
export const STALL_MS=10000;   // 이만큼 화면이 안 들어오면 상태줄에 표시(소리 알림은 없음, 2026-11-10 사용자 결정)
export const health={lostAt:null,badSince:null,badWarned:false,okAt:0};
/* ----- 화면 소스 ----- */
export let src=null;            // {type:'stream', video, track, cap} | {type:'image', img}
export const frame={w:0,h:0};
export let lastBitmap=null;
export let frameFresh=true;
export function setFrameFresh(v){ frameFresh=v; }     // 마지막 grab()이 새 프레임이었는지. 숨은 탭에서 grabFrame 실패 뒤 video로 대체했으면 false(묶음 3이 화면 변화 판단에서 제외)
// grabFrame()은 새 프레임이 올 때까지 기다리므로, 화면이 멈추면 감지 루프 전체가 멈추지 않게 시간 제한을 둠
export function grabFrameWithin(cap, ms){
  return new Promise((resolve,reject)=>{ let late=false;
    const timer=setTimeout(()=>{ late=true; reject(new Error('timeout')); },ms);
    cap.grabFrame().then(b=>{ if(late){ if(b.close) b.close(); return; } clearTimeout(timer); resolve(b); },
                         e=>{ if(!late){ clearTimeout(timer); reject(e); } });
  });
}
// 카드·상태줄·감지가 함께 쓰는 화면 상황. live=실제 화면 공유(스크린샷 테스트가 아님), fresh=마지막 프레임이 새 것
export function viewCtx(){ return {src:!!src,frame,live:!!src&&src.type==='stream',fresh:frameFresh}; }
// {frame, fresh}를 돌려준다. frame이 null이면 프레임이 없는 것(화면 안 들어옴으로 집계)
export async function grab(){
  if(!src) return {frame:null,fresh:false};
  if(src.type==='image') return {frame:src.img,fresh:true};
  let fresh=true;
  if(src.cap && document.hidden){
    try{ const b=await grabFrameWithin(src.cap,1500); if(lastBitmap&&lastBitmap.close) lastBitmap.close(); lastBitmap=b; return {frame:b,fresh:true}; }
    catch(e){ if(e.message==='timeout') return {frame:null,fresh:false}; fresh=false; }   // 새 프레임이 없음 → 화면 안 들어옴으로 집계. 다른 오류는 video로 대체(오래된 프레임일 수 있음)
  }
  return {frame:src.video.readyState>=2 ? src.video : null, fresh};
}
export function dims(s){ return s instanceof HTMLVideoElement ? [s.videoWidth,s.videoHeight] : [s.naturalWidth||s.width, s.naturalHeight||s.height]; }

// 게임 화면 자리의 안내문(화면이 없을 때만 보인다). 연결이 끊겨서 멈췄으면 다시 연결하라고 한다
export const emptyText=()=>health.lostAt?EMPTY_LOST:EMPTY_DEFAULT;
export function teardown(){
  Alerts.clear();   // 묶음 대기 중이던 알림은 연결 알림이 우선이라 버린다
  src=null; if(pctx) pctx.clearRect(0,0,pv.width,pv.height);   // 멈춘 마지막 화면 대신 빈 화면 위에 안내문을 보여줌
  Object.assign(connectBtn,{label:'게임 화면 연결',primary:true});
  renderWatch();
}
// 상태줄의 "감시 끝내기"·"테스트 끝내기"
export function stopWatching(){
  const wasTest=src&&src.type==='image';
  if(src&&src.track) src.track.stop(); health.lostAt=null; health.badWarned=false;
  teardown(); setNote(wasTest?'스크린샷 테스트를 끝냈어요':'감시를 끝냈어요','info');
}
// 헤더의 "게임 화면 연결" 버튼. 연결 뒤에는 주된 행동이 아니므로 "다른 창 연결"로 바꾸고 강조를 뺀다
export const connectBtn={label:'게임 화면 연결',primary:true};
export async function connect(){
  unlockAudio(); setNote('');
  try{
    const stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:5,max:10},cursor:'never'},audio:false});
    const video=document.createElement('video'); video.muted=true; video.playsInline=true; video.srcObject=stream; await video.play();
    const track=stream.getVideoTracks()[0];
    let cap=null; try{ if('ImageCapture' in window) cap=new ImageCapture(track); }catch(e){}
    if(src&&src.track) src.track.stop();   // 다른 창으로 바꾸면 이전 공유를 닫음 (stop()은 ended를 일으키지 않음)
    // 사용자가 브라우저의 “공유 중지”를 누르거나 게임 창이 닫히면 감시가 멈춘다. 상태줄에만 표시(소리 알림은 없음, 2026-11-10 사용자 결정). 지금 쓰는 공유일 때만
    track.onended=()=>{
      if(!src||src.track!==track) return;
      Object.assign(health,{lostAt:Date.now(),badSince:null,badWarned:false});
      teardown();
    };
    src={type:'stream',video,track,cap};
    Object.assign(connectBtn,{label:'다른 창 연결',primary:false});
    Object.assign(health,{lostAt:null,badSince:null,badWarned:false,okAt:Date.now()});
    resetAllStates(false);
    ui.connectedOnce=true; saveUi();
    const need=store.targets.filter(t=>t.enabled&&KINDS[t.kind]&&!KINDS[t.kind].isRegistered(t)).map(t=>t.name);
    speak(WATCH_START+(need.length?`. ${eunNeun(need.join(', '))} 등록이 필요해요`:''));
    renderWatch();
  }catch(e){ if(e.name!=='NotAllowedError') setNote(`화면 연결에 실패했어요 (${e.message}). “게임 화면 연결”을 다시 눌러 주세요.`); }
}
// "스크린샷으로 테스트": 고른 이미지를 화면 대신 쓴다(처음부터 켜짐 시각을 믿는다)
export function loadImageFile(f){
  const img=new Image();
  img.onload=()=>{ if(src&&src.track) src.track.stop(); src={type:'image',img}; health.lostAt=null; health.badWarned=false; resetAllStates(true); renderWatch(); };
  img.src=URL.createObjectURL(f);
}
// "브라우저 알림 허용" 버튼 문구
export const notifyBtn={label:'브라우저 알림 허용'};
export async function requestNotify(){
  unlockAudio();
  if(!('Notification' in window)){ setNote('이 브라우저는 알림을 지원하지 않아요. 소리와 음성으로만 알려요','info'); return; }
  const p=await Notification.requestPermission(); notifyBtn.label=p==='granted'?'알림 허용됨':'알림 차단됨'; bump();
  if(p!=='granted') setNote('브라우저 알림이 차단돼 있어요. 소리와 음성으로만 알려요','info');
}
export function initCapture(){
  if('Notification' in window && Notification.permission==='granted'){ notifyBtn.label='알림 허용됨'; bump(); }
}
