const EMPTY_DEFAULT='“게임 화면 연결”을 눌러 메이플스토리 창을 공유하세요.';
const EMPTY_LOST='화면 연결이 끊겼어요. “게임 화면 연결”을 다시 눌러 주세요.';
const STALL_MS=10000, LOST_REMIND_MS=120000, LOST_REMIND_MAX=2;
const health={lostAt:null,reminders:0,remindAt:0,badSince:null,badWarned:false,okAt:0};
/* ----- 화면 소스 ----- */
let src=null;            // {type:'stream', video, track, cap} | {type:'image', img}
const frame={w:0,h:0};
const work=document.createElement('canvas'); const wctx=work.getContext('2d',{willReadFrequently:true});
let lastBitmap=null;
let frameFresh=true;     // 마지막 grab()이 새 프레임이었는지. 숨은 탭에서 grabFrame 실패 뒤 video로 대체했으면 false(묶음 3이 화면 변화 판단에서 제외)
// grabFrame()은 새 프레임이 올 때까지 기다리므로, 화면이 멈추면 감지 루프 전체가 멈추지 않게 시간 제한을 둠
function grabFrameWithin(cap, ms){
  return new Promise((resolve,reject)=>{ let late=false;
    const timer=setTimeout(()=>{ late=true; reject(new Error('timeout')); },ms);
    cap.grabFrame().then(b=>{ if(late){ if(b.close) b.close(); return; } clearTimeout(timer); resolve(b); },
                         e=>{ if(!late){ clearTimeout(timer); reject(e); } });
  });
}
// 카드·상태줄·감지가 함께 쓰는 화면 상황. live=실제 화면 공유(스크린샷 테스트가 아님), fresh=마지막 프레임이 새 것
function viewCtx(){ return {src:!!src,frame,live:!!src&&src.type==='stream',fresh:frameFresh}; }
// {frame, fresh}를 돌려준다. frame이 null이면 프레임이 없는 것(화면 안 들어옴으로 집계)
async function grab(){
  if(!src) return {frame:null,fresh:false};
  if(src.type==='image') return {frame:src.img,fresh:true};
  let fresh=true;
  if(src.cap && document.hidden){
    try{ const b=await grabFrameWithin(src.cap,1500); if(lastBitmap&&lastBitmap.close) lastBitmap.close(); lastBitmap=b; return {frame:b,fresh:true}; }
    catch(e){ if(e.message==='timeout') return {frame:null,fresh:false}; fresh=false; }   // 새 프레임이 없음 → 화면 안 들어옴으로 집계. 다른 오류는 video로 대체(오래된 프레임일 수 있음)
  }
  return {frame:src.video.readyState>=2 ? src.video : null, fresh};
}
function dims(s){ return s instanceof HTMLVideoElement ? [s.videoWidth,s.videoHeight] : [s.naturalWidth||s.width, s.naturalHeight||s.height]; }

function teardown(emptyText){
  Alerts.clear();   // 묶음 대기 중이던 알림은 연결 알림이 우선이라 버린다
  src=null; pctx.clearRect(0,0,pv.width,pv.height);   // 멈춘 마지막 화면 대신 빈 화면 위에 안내문을 보여줌
  $('#empty').textContent=emptyText; $('#empty').style.display=''; $('#btnConnect').textContent='게임 화면 연결'; $('#btnConnect').classList.add('primary');
  store.targets.forEach(renderCard); renderWatch();
}
function initCapture(){
$('#btnConnect').onclick=async()=>{
  unlockAudio(); setNote('');
  try{
    const stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:5,max:10},cursor:'never'},audio:false});
    const video=document.createElement('video'); video.muted=true; video.playsInline=true; video.srcObject=stream; await video.play();
    const track=stream.getVideoTracks()[0];
    let cap=null; try{ if('ImageCapture' in window) cap=new ImageCapture(track); }catch(e){}
    if(src&&src.track) src.track.stop();   // 다른 창으로 바꾸면 이전 공유를 닫음 (stop()은 ended를 일으키지 않음)
    // 사용자가 브라우저의 “공유 중지”를 누르거나 게임 창이 닫히면 감시가 멈추므로 소리로 알림. 지금 쓰는 공유일 때만
    track.onended=()=>{
      if(!src||src.track!==track) return;
      Object.assign(health,{lostAt:Date.now(),reminders:0,remindAt:Date.now(),badSince:null,badWarned:false});
      teardown(EMPTY_LOST); fireSystem('lost');
    };
    src={type:'stream',video,track,cap}; $('#empty').style.display='none';
    $('#btnConnect').textContent='다른 창 연결'; $('#btnConnect').classList.remove('primary');   // 연결 뒤에는 주된 행동이 아님
    Object.assign(health,{lostAt:null,badSince:null,badWarned:false,okAt:Date.now()});
    resetAllStates(false);
    ui.connectedOnce=true; saveUi();
    const need=store.targets.filter(t=>t.enabled&&KINDS[t.kind]&&!KINDS[t.kind].isRegistered(t)).map(t=>t.name);
    speak('감시 시작할게요'+(need.length?`. ${eunNeun(need.join(', '))} 등록이 필요해요`:''));
    renderWatch();
  }catch(e){ if(e.name!=='NotAllowedError') setNote(`화면 연결에 실패했어요 (${e.message}). “게임 화면 연결”을 다시 눌러 주세요.`); }
};
$('#btnStop').onclick=()=>{
  const wasTest=src&&src.type==='image';
  if(src&&src.track) src.track.stop(); health.lostAt=null; health.badWarned=false;
  teardown(EMPTY_DEFAULT); setNote(wasTest?'스크린샷 테스트를 끝냈어요':'감시를 끝냈어요','info');
};
$('#btnImage').onclick=()=>$('#fileImage').click();
$('#fileImage').onchange=e=>{
  const f=e.target.files[0]; if(!f) return; const img=new Image();
  img.onload=()=>{ if(src&&src.track) src.track.stop(); src={type:'image',img}; health.lostAt=null; health.badWarned=false; $('#empty').style.display='none'; resetAllStates(true); renderWatch(); };
  img.src=URL.createObjectURL(f); e.target.value='';
};
$('#btnNotify').onclick=async()=>{
  unlockAudio();
  if(!('Notification' in window)){ setNote('이 브라우저는 알림을 지원하지 않아요. 소리와 음성으로만 알려요','info'); return; }
  const p=await Notification.requestPermission(); $('#btnNotify').textContent=p==='granted'?'알림 허용됨':'알림 차단됨';
  if(p!=='granted') setNote('브라우저 알림이 차단돼 있어요. 소리와 음성으로만 알려요','info');
};
if('Notification' in window && Notification.permission==='granted') $('#btnNotify').textContent='알림 허용됨';
}
