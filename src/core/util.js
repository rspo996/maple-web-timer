export const fmt=s=>{ s=Math.max(0,Math.ceil(s)); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); };
export const parseDur=v=>{ v=(v||'').trim(); if(!v) return null; const m=v.match(/^(\d+)(?::(\d{1,2}))?$/); if(!m) return undefined; return m[2]!==undefined? (+m[1])*60+(+m[2]) : (+m[1])*60; };
export const clampInt=(v,lo,hi,dflt)=>{ v=Math.round(+v); return Number.isFinite(v)&&v>=lo ? Math.min(hi,v) : dflt; };
export const batchim=w=>{ const k=w.charCodeAt(w.length-1)-0xAC00; return k>=0&&k<11172&&k%28>0; };
export const eunNeun=w=>w+(batchim(w)?'은':'는');   // 받침에 맞춘 은/는
export const eulReul=w=>w+(batchim(w)?'을':'를');   // 받침에 맞춘 을/를
// 음량(퍼센트 정수 0~200, 기본 80). 내부 배율은 pct/100이라 1.0이 예전의 100%와 같다. 음성은 1을 넘지 못한다
export const clampVolumePct=v=>{ if(v==null||v==='') return 80; const n=Math.round(Number(v)); return Number.isFinite(n)?Math.min(200,Math.max(0,n)):80; };
export const volumeToGain=pct=>pct/100;
export const ttsVolume=pct=>Math.min(1,pct/100);
// 지속시간이 미리 알림 초 이하이면 켜지자마자 미리 알림이 울린다 → 입력을 거절하는 문구(통과하면 null). field: 'duration'|'lead'
export const checkDurLead=(durationSec,leadSec,field)=>{
  if(!durationSec||durationSec>leadSec) return null;
  return field==='lead' ? `미리 알림은 지속시간(${fmt(durationSec)})보다 짧게 입력해 주세요` : `미리 알림(${leadSec}초)보다 길게 입력해 주세요`;
};
