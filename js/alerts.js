/* ----- 알림 ----- */
// 소리만 듣고도 무슨 알림인지 알 수 있게 대상·이벤트마다 패턴을 나눔. 연결 문제는 음색부터 다르게(톱니파, 낮은 음)
const SOUNDS={
  sol:    {wave:'square',  notes:[[1046,.15],[1046,.15],[784,.3]]},              // 딩딩-동
  booster:{wave:'square',  notes:[[1318,.08],[1318,.08],[1318,.08],[988,.28]]},  // 딱딱딱-동
  gone:   {wave:'square',  notes:[[784,.2],[523,.45]]},                          // 내려가는 두 음
  rune:   {wave:'square',  notes:[[880,.12],[1175,.12],[1568,.2]]},              // 올라가는 세 음
  system: {wave:'sawtooth',notes:[[330,.22],[330,.22],[330,.22]],gain:.13},      // 낮은 경고음
};
let actx=null, beepEnd=0;
function unlockAudio(){ try{ actx=actx||new AudioContext(); if(actx.state==='suspended') actx.resume(); }catch(e){} predecodeSounds(); }
// 알림 순간에 디코딩하느라 순서가 밀리지 않도록, 오디오를 켤 때 내 소리를 미리 풀어 둠
function predecodeSounds(){ if(!actx) return; for(const c of customSounds.values()) if(!c.buf&&!c.decoding){ c.decoding=true; actx.decodeAudioData(c.data.slice(0)).then(b=>{ c.buf=b; },()=>{}).finally(()=>{ c.decoding=false; }); } }
// 앞 소리가 끝난 뒤에 이어서 예약해 겹치지 않게 함. 끝날 때까지 남은 초를 돌려줌
function beep(name){
  const s=SOUNDS[name]; if(!actx||!s) return 0;
  const amp=(s.gain||.18)*(+$('#vol').value); let t=Math.max(actx.currentTime+0.02, beepEnd);
  for(const [f,dur] of s.notes){ const o=actx.createOscillator(), g=actx.createGain();
    o.type=s.wave; o.frequency.value=f; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(amp,t+0.01); g.gain.setValueAtTime(amp,t+dur-0.03); g.gain.linearRampToValueAtTime(0,t+dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t+dur); t+=dur+0.06; }
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
const MSG={
  pre:(d,c)=>`${d.name} ${c.leadSec}초 전`,
  gone:d=>`${d.name} 꺼졌어요`,
  appear:()=>'룬이 나왔어요',
  remind:()=>'룬 아직 있어요',
  unread:d=>`${d.name} 숫자를 못 읽고 있어요`,
};
const SYS_MSG={ lost:'화면 연결이 끊겼어요. 다시 연결해 주세요', stall:'게임 화면이 들어오지 않아요', back:'게임 화면이 다시 들어와요' };
let toastTimer, titleTimer=null;
// 기본 소리: 경고음 뒤에 음성
function playDefault(msg, sound){ const wait=beep(sound); setTimeout(()=>speak(msg), Math.round(wait*1000)+150); }
// slot에 내 소리가 있으면 그걸 틀고, 없으면 기본 소리
function notify(msg, sound, tag, slot){
  if(!playCustom(slot, ()=>playDefault(msg,sound))) playDefault(msg, sound);
  const t=$('#toast'); t.textContent=msg; t.style.display='block'; clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.style.display='none',6000);
  clearInterval(titleTimer); let i=0;
  titleTimer=setInterval(()=>{ document.title=(i++%2)?'⚠ '+msg:baseTitle(); if(i>12){ clearInterval(titleTimer); titleTimer=null; document.title=baseTitle(); } },700);
  if(document.hidden && 'Notification' in window && Notification.permission==='granted'){ try{ new Notification(msg,{tag,renotify:true}); }catch(e){} }
}
const soundName=(d,kind)=> kind==='gone' ? 'gone' : kind==='unread' ? 'system' : d.kind==='rune' ? 'rune'
                         : SOUNDS[d.id] ? d.id : d.kind==='countdown' ? 'booster' : 'sol';
function fire(d, kind){
  notify(MSG[kind](d,cfgs[d.id]), soundName(d,kind), d.id, `${d.id}.${kind}`);
  const card=$('#card-'+d.id); card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
}
// 화면을 받는 쪽의 문제(끊김·멈춤)는 게임 알림과 다른 소리로 알림. 회복은 음성만
function fireSystem(kind){ if(kind==='back'){ speak(SYS_MSG.back); return; } notify(SYS_MSG[kind],'system','system','sys.'+kind); }
