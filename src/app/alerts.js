/* ===== 알림 경로 (묶음 1 스펙 7절). 모든 알림은 Alerts.fire 한 곳을 지난다 ===== */
import {bump} from './bus.js';
import {volPct,voiceOn} from './audio.js';
import {customSounds,playCustom} from './sounds.js';
import {clipFor,loadClips} from './voice.js';
import {baseTitle} from './watch.js';
import {createAlerts} from '../core/alerts-core.js';
import {ttsVolume} from '../core/util.js';
// 소리만 듣고도 무슨 알림인지 알 수 있게 대상·이벤트마다 패턴을 나눔. 연결 문제는 음색부터 다르게(톱니파, 낮은 음)
export const BUFF_BEEP={wave:'square',notes:[[1046,.15],[1046,.15],[784,.3]]};   // 딩딩-동
export const SOUNDS={
  buff:   BUFF_BEEP,                                                              // 모든 버프 공용(솔 야누스 포함)
  booster:{wave:'square',  notes:[[1318,.08],[1318,.08],[1318,.08],[988,.28]]},  // 딱딱딱-동
  gone:   {wave:'square',  notes:[[784,.2],[523,.45]]},                          // 내려가는 두 음
  rune:   {wave:'square',  notes:[[880,.12],[1175,.12],[1568,.2]]},              // 올라가는 세 음
  multi:  {wave:'square',  notes:[[1046,.1],[1046,.1],[1046,.1],[1568,.28]]},    // 같은 음 세 번 + 높은 음(묶인 알림)
  timer:  {wave:'square',  notes:[[988,.14],[988,.14]]},                          // 같은 음 두 번(수동 타이머 미리 알림)
  idle:   {wave:'triangle',notes:[[587,.3],[440,.3],[587,.3],[440,.3]],gain:.24},  // 느린 두 음 왕복(사냥 멈춤)
  system: {wave:'sawtooth',notes:[[330,.22],[330,.22],[330,.22]],gain:.13},      // 낮은 경고음
};
export let actx=null, beepEnd=0, audioOutNode=null; export const audioWaiters=[];
export function setBeepEnd(v){ beepEnd=v; }   // 내 소리(sounds.js)도 같은 재생 순서에 줄을 선다
export function unlockAudio(){
  try{ actx=actx||new AudioContext(); if(actx.state==='suspended') actx.resume(); }catch(e){}
  predecodeSounds(); loadClips();
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
// 미리 만든 Gemini 음성(묶음 6)이 있으면 경고음 시간줄(beepEnd) 뒤에 이어서 재생. 처리했으면(재생·중복·음성 끔) true, 그 문구 음성이 없으면 false
let ttsWait=0;   // 브라우저 음성이 예약됐거나 말하는 중인 수
const ttsBusy=()=>ttsWait>0||('speechSynthesis' in window&&(speechSynthesis.speaking||speechSynthesis.pending));
export function speakClip(text){
  const buf=clipFor(text); if(!buf||!actx) return false;
  if(ttsBusy()) return false;   // 브라우저 음성이 말하는 중이면 클립을 바로 얹지 않는다(두 목소리가 겹침). 그 문구도 음성 대기열로 보낸다
  if(!voiceOn()) return true;
  const now=Date.now(); if(now-(spokenAt.get(text)||0)<8000) return true; spokenAt.set(text,now);
  const n=actx.createBufferSource(); n.buffer=buf; n.connect(Alerts.audioOut());   // 마스터를 지나 음량 0~200%
  const t=Math.max(actx.currentTime+0.02,beepEnd); n.start(t); beepEnd=t+buf.duration+0.06;
  return true;
}
export function speak(text){
  if(speakClip(text)) return;
  if(!voiceOn()||!('speechSynthesis' in window)) return;
  const now=Date.now(); if(now-(spokenAt.get(text)||0)<8000) return; spokenAt.set(text,now);
  if((speechSynthesis.speaking||speechSynthesis.pending) && now-speakQueuedAt>15000) speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text); u.lang='ko-KR'; u.volume=ttsVolume(volPct()); u.rate=1.1;
  const ahead=actx?beepEnd-actx.currentTime:0;   // 시간줄에 이미 예약된 소리(경고음·클립)가 끝난 뒤에 말한다
  if(ahead>0.05){ ttsWait++; setTimeout(()=>{ ttsWait--; speechSynthesis.speak(u); },Math.round(ahead*1000)); }
  else speechSynthesis.speak(u);
  speakQueuedAt=now;
}
export let toastTimer, titleTimer=null;
export const toast={text:'',on:false};   // 화면 아래 알림 문구(ui/Toast.jsx). 6초 보인다
// 기본 소리: 경고음 뒤에 음성. beep가 없으면 음성만
export function playDefault(msg, sound){ const wait=sound?beep(sound):0; if(speakClip(msg)) return; ttsWait++; setTimeout(()=>{ ttsWait--; speak(msg); }, Math.round(wait*1000)+150); }

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
    toast.text=text; toast.on=true; bump(); clearTimeout(toastTimer); toastTimer=setTimeout(()=>{ toast.on=false; bump(); },6000);
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

