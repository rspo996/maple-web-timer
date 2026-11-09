/* ===== 알림 경로 (묶음 1 스펙 7절). 모든 알림은 Alerts.fire 한 곳을 지난다 ===== */
// 소리만 듣고도 무슨 알림인지 알 수 있게 대상·이벤트마다 패턴을 나눔. 연결 문제는 음색부터 다르게(톱니파, 낮은 음)
const BUFF_BEEP={wave:'square',notes:[[1046,.15],[1046,.15],[784,.3]]};   // 딩딩-동
const SOUNDS={
  buff:   BUFF_BEEP,                                                              // 모든 버프 공용(솔 야누스 포함)
  booster:{wave:'square',  notes:[[1318,.08],[1318,.08],[1318,.08],[988,.28]]},  // 딱딱딱-동
  gone:   {wave:'square',  notes:[[784,.2],[523,.45]]},                          // 내려가는 두 음
  rune:   {wave:'square',  notes:[[880,.12],[1175,.12],[1568,.2]]},              // 올라가는 세 음
  system: {wave:'sawtooth',notes:[[330,.22],[330,.22],[330,.22]],gain:.13},      // 낮은 경고음
};
let actx=null, beepEnd=0, audioOutNode=null; const audioWaiters=[];
function unlockAudio(){
  try{ actx=actx||new AudioContext(); if(actx.state==='suspended') actx.resume(); }catch(e){}
  predecodeSounds();
  if(actx) while(audioWaiters.length){ const fn=audioWaiters.shift(); try{ fn(actx); }catch(e){ console.error(e); } }
}
// 알림 순간에 디코딩하느라 순서가 밀리지 않도록, 오디오를 켤 때 내 소리를 미리 풀어 둠
function predecodeSounds(){ if(!actx) return; for(const c of customSounds.values()) if(!c.buf&&!c.decoding){ c.decoding=true; actx.decodeAudioData(c.data.slice(0)).then(b=>{ c.buf=b; },()=>{}).finally(()=>{ c.decoding=false; }); } }
// 앞 소리가 끝난 뒤에 이어서 예약해 겹치지 않게 함. 끝날 때까지 남은 초를 돌려줌
function beep(name){
  const s=SOUNDS[name]; if(!actx||!s) return 0;
  const amp=(s.gain||.18)*(+$('#vol').value); let t=Math.max(actx.currentTime+0.02, beepEnd);
  for(const [f,dur] of s.notes){ const o=actx.createOscillator(), g=actx.createGain();
    o.type=s.wave; o.frequency.value=f; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(amp,t+0.01); g.gain.setValueAtTime(amp,t+dur-0.03); g.gain.linearRampToValueAtTime(0,t+dur);
    o.connect(g).connect(Alerts.audioOut()); o.start(t); o.stop(t+dur); t+=dur+0.06; }
  beepEnd=t; return t-actx.currentTime;
}
// 음성은 끊지 않고 차례로 말함. 같은 문구가 8초 안에 또 오면 건너뛰고, 큐가 15초 넘게 막혀 있으면 비운 뒤 다시 말함
const spokenAt=new Map(); let speakQueuedAt=0;
function speak(text){
  if(!$('#voice').checked||!('speechSynthesis' in window)) return;
  const now=Date.now(); if(now-(spokenAt.get(text)||0)<8000) return; spokenAt.set(text,now);
  if((speechSynthesis.speaking||speechSynthesis.pending) && now-speakQueuedAt>15000) speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text); u.lang='ko-KR'; u.volume=+$('#vol').value; u.rate=1.1;
  speechSynthesis.speak(u); speakQueuedAt=now;
}
const SYS_MSG={ lost:'화면 연결이 끊겼어요. 다시 연결해 주세요', stall:'게임 화면이 들어오지 않아요', back:'게임 화면이 다시 들어와요' };
let toastTimer, titleTimer=null;
// 기본 소리: 경고음 뒤에 음성. beep가 없으면 음성만
function playDefault(msg, sound){ const wait=sound?beep(sound):0; setTimeout(()=>speak(msg), Math.round(wait*1000)+150); }

/* ----- 가까운 알림 묶기 계획 (순수) ----- */
// fired: 이번 틱에 미리 알림(group:'pre')이 난 대상 id. 곧 끝나는 다른 대상(남은 시간 <= leadSec+windowSec)을 같이 묶는다(당겨 알림).
// 돌려주는 값: members(묶일 대상 전부)와 pulled(그중 당겨온 것). 상태는 바꾸지 않는다 — 당겨온 대상의 pre 처리(markPre)는 부르는 쪽이 한다
function planGroup(fired,targets,states,kinds,now,windowSec){
  if(!fired.length) return {members:[],pulled:[]};
  const members=[], pulled=[];
  targets.forEach((t,order)=>{
    const k=kinds[t.kind]; if(!k||!t.enabled) return;
    if(fired.includes(t.id)){ members.push({id:t.id,rank:t.p.leadSec||0,pulled:false,order}); return; }
    if(!k.events.some(e=>e.group==='pre')) return;                    // 룬 같은 종류는 묶지 않는다
    const st=states[t.id]; if(!st||st.alertedPre) return;
    const r=k.remainSec(t,st,now); if(r==null) return;                // 켜진 시점·지속시간을 모르면 null
    if(r<=(t.p.leadSec||0)+windowSec){ members.push({id:t.id,rank:r,pulled:true,order}); pulled.push({id:t.id,rank:r}); }
  });
  return {members,pulled};
}
// 묶인 알림의 음성·토스트 문구. 이름 뒤 조사를 쓰지 않고 초는 말하지 않는다(멤버마다 남은 시간이 달라 한 숫자가 틀림)
function groupText(cls,items){
  const sorted=[...items].sort((a,b)=>a.rank-b.rank||a.order-b.order), tail=cls==='pre'?'곧 끝나요':'꺼졌어요';
  return sorted.length>=4?`${sorted.length}개 ${tail}`:`${sorted.map(i=>i.label).join(', ')} ${tail}`;
}

/* ----- Alerts: 요청(AlertReq)을 받아 소리·화면 알림·카드 깜빡임으로 내보낸다. io를 바꿔 끼워 node에서 시험한다 -----
   AlertReq = {src:'target'|'manual'|'system'|'test', id, event, text, beep:string|null, slot:string|null, mode:'full'|'voice', group, flash:string|null}
   AlertRec = {at, src, ids[], event, text, grouped, custom}  (listen 구독자가 재생 직후 받음) */
function createAlerts(io){
  const listeners=new Set();
  const withDefaults=r=>Object.assign({},r,{
    slot:r.slot===undefined?`${r.id}.${r.event}`:r.slot, flash:r.flash===undefined?`card-${r.id}`:r.flash,
    mode:r.mode||'full', beep:r.beep===undefined?null:r.beep, group:r.group||null });
  function deliver(req){
    const custom=io.play(req);
    if(req.mode!=='voice'){ io.ui(req.text,req.id); if(req.flash) io.flash([req.flash]); }
    const rec={at:io.now(),src:req.src,ids:[req.id],event:req.event,text:req.text,grouped:false,custom};
    for(const fn of [...listeners]){ try{ fn(rec); }catch(e){ console.error(e); } }
  }
  return {
    fire(req){ deliver(withDefaults(req)); },
    flush(now){},                                    // tick() 끝에서 부른다. 묶기 대기열은 Task G2에서 채운다
    drop(id){},                                      // 삭제·끈 대상의 대기 중 알림을 뺀다(Task G2)
    clear(){},                                       // 연결이 끊겼을 때 대기열을 비운다(Task G2)
    listen(fn){ listeners.add(fn); return ()=>listeners.delete(fn); },
  };
}
const browserIO={
  now:()=>Date.now(),
  // 내 소리 슬롯이 있으면 그것, 없으면 비프 뒤 음성. 돌려주는 값은 내 소리를 썼는지
  play(req){
    if(req.mode==='voice'){ speak(req.text); return false; }
    const custom=playCustom(req.slot, ()=>playDefault(req.text,req.beep));
    if(!custom) playDefault(req.text,req.beep);
    return custom;
  },
  ui(text,tag){
    const t=$('#toast'); t.textContent=text; t.style.display='block'; clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.style.display='none',6000);
    clearInterval(titleTimer); let i=0;
    titleTimer=setInterval(()=>{ document.title=(i++%2)?'⚠ '+text:baseTitle(); if(i>12){ clearInterval(titleTimer); titleTimer=null; document.title=baseTitle(); } },700);
    if(document.hidden && 'Notification' in window && Notification.permission==='granted'){ try{ new Notification(text,{tag,renotify:true}); }catch(e){} }
  },
  flash(ids){ for(const id of ids){ const el=document.getElementById(id); if(el){ el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } } },
};
const Alerts=Object.assign(createAlerts(browserIO),{
  // 묶음 5(볼륨 증폭)가 마스터 노드를 꽂는 자리. unlockAudio() 전에는 null
  audioOut:()=>actx?(audioOutNode||actx.destination):null,
  setAudioOut:node=>{ audioOutNode=node; },
  onAudioReady:fn=>{ if(actx) fn(actx); else audioWaiters.push(fn); },
});

// 화면을 받는 쪽의 문제(끊김·멈춤)는 게임 알림과 다른 소리로 알림. 회복은 음성만
function fireSystem(kind){ Alerts.fire({src:'system',id:'sys',event:kind,text:SYS_MSG[kind],beep:'system',slot:'sys.'+kind,mode:kind==='back'?'voice':'full',flash:null}); }
if(typeof module==='object') module.exports={createAlerts,planGroup,groupText};
