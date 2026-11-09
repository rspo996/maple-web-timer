/* ===== 알림 경로 (묶음 1 스펙 7절). 모든 알림은 Alerts.fire 한 곳을 지난다 ===== */
import {$} from './dom.js';
import {customSounds,playCustom} from './sounds.js';
import {baseTitle} from './ui-watch.js';
import {createAlerts} from '../core/alerts-core.js';
import {clampVolumePct,ttsVolume} from '../core/util.js';
// 소리만 듣고도 무슨 알림인지 알 수 있게 대상·이벤트마다 패턴을 나눔. 연결 문제는 음색부터 다르게(톱니파, 낮은 음)
export const BUFF_BEEP={wave:'square',notes:[[1046,.15],[1046,.15],[784,.3]]};   // 딩딩-동
export const SOUNDS={
  buff:   BUFF_BEEP,                                                              // 모든 버프 공용(솔 야누스 포함)
  booster:{wave:'square',  notes:[[1318,.08],[1318,.08],[1318,.08],[988,.28]]},  // 딱딱딱-동
  gone:   {wave:'square',  notes:[[784,.2],[523,.45]]},                          // 내려가는 두 음
  rune:   {wave:'square',  notes:[[880,.12],[1175,.12],[1568,.2]]},              // 올라가는 세 음
  multi:  {wave:'square',  notes:[[1046,.1],[1046,.1],[1046,.1],[1568,.28]]},    // 같은 음 세 번 + 높은 음(묶인 알림)
  timer:  {wave:'square',  notes:[[988,.14],[988,.14]]},                          // 같은 음 두 번(수동 타이머 미리 알림)
  ready:  {wave:'square',  notes:[[784,.12],[1175,.24]]},                         // 올라가는 두 음(설치기 다시 쓸 수 있음)
  idle:   {wave:'triangle',notes:[[587,.3],[440,.3],[587,.3],[440,.3]],gain:.24},  // 느린 두 음 왕복(사냥 멈춤)
  system: {wave:'sawtooth',notes:[[330,.22],[330,.22],[330,.22]],gain:.13},      // 낮은 경고음
};
export let actx=null, beepEnd=0, audioOutNode=null; export const audioWaiters=[];
export function setBeepEnd(v){ beepEnd=v; }   // 내 소리(sounds.js)도 같은 재생 순서에 줄을 선다
export function unlockAudio(){
  try{ actx=actx||new AudioContext(); if(actx.state==='suspended') actx.resume(); }catch(e){}
  predecodeSounds();
  if(actx) while(audioWaiters.length){ const fn=audioWaiters.shift(); try{ fn(actx); }catch(e){ console.error(e); } }
}
// 알림 순간에 디코딩하느라 순서가 밀리지 않도록, 오디오를 켤 때 내 소리를 미리 풀어 둠
export function predecodeSounds(){ if(!actx) return; for(const c of customSounds.values()) if(!c.buf&&!c.decoding){ c.decoding=true; actx.decodeAudioData(c.data.slice(0)).then(b=>{ c.buf=b; },()=>{}).finally(()=>{ c.decoding=false; }); } }
// 앞 소리가 끝난 뒤에 이어서 예약해 겹치지 않게 함. 끝날 때까지 남은 초를 돌려줌
export function beep(name){
  const s=SOUNDS[name]; if(!actx||!s) return 0;
  const amp=s.gain||.18; let t=Math.max(actx.currentTime+0.02, beepEnd);   // 음량은 마스터(Alerts.audioOut)에서 한 번만 곱한다(묶음 5)
  for(const [f,dur] of s.notes){ const o=actx.createOscillator(), g=actx.createGain();
    o.type=s.wave; o.frequency.value=f; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(amp,t+0.01); g.gain.setValueAtTime(amp,t+dur-0.03); g.gain.linearRampToValueAtTime(0,t+dur);
    o.connect(g).connect(Alerts.audioOut()); o.start(t); o.stop(t+dur); t+=dur+0.06; }
  beepEnd=t; return t-actx.currentTime;
}
// 음성은 끊지 않고 차례로 말함. 같은 문구가 8초 안에 또 오면 건너뛰고, 큐가 15초 넘게 막혀 있으면 비운 뒤 다시 말함
export const spokenAt=new Map(); export let speakQueuedAt=0;
export function speak(text){
  if(!$('#voice').checked||!('speechSynthesis' in window)) return;
  const now=Date.now(); if(now-(spokenAt.get(text)||0)<8000) return; spokenAt.set(text,now);
  if((speechSynthesis.speaking||speechSynthesis.pending) && now-speakQueuedAt>15000) speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text); u.lang='ko-KR'; u.volume=ttsVolume(clampVolumePct($('#vol').value)); u.rate=1.1;
  speechSynthesis.speak(u); speakQueuedAt=now;
}
export const SYS_MSG={ lost:'화면 연결이 끊겼어요. 다시 연결해 주세요', stall:'게임 화면이 들어오지 않아요', back:'게임 화면이 다시 들어와요' };
export let toastTimer, titleTimer=null;
// 기본 소리: 경고음 뒤에 음성. beep가 없으면 음성만
export function playDefault(msg, sound){ const wait=sound?beep(sound):0; setTimeout(()=>speak(msg), Math.round(wait*1000)+150); }

export const browserIO={
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
export const Alerts=Object.assign(createAlerts(browserIO),{
  // 묶음 5(볼륨 증폭)가 마스터 노드를 꽂는 자리. unlockAudio() 전에는 null
  audioOut:()=>actx?(audioOutNode||actx.destination):null,
  setAudioOut:node=>{ audioOutNode=node; },
  onAudioReady:fn=>{ if(actx) fn(actx); else audioWaiters.push(fn); },
});

// 화면을 받는 쪽의 문제(끊김·멈춤)는 게임 알림과 다른 소리로 알림. 회복은 음성만
export function fireSystem(kind){ Alerts.fire({src:'system',id:'sys',event:kind,text:SYS_MSG[kind],beep:'system',slot:'sys.'+kind,mode:kind==='back'?'voice':'full',flash:null}); }
