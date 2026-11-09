const $=s=>document.querySelector(s);
const fmt=s=>{ s=Math.max(0,Math.ceil(s)); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); };
const parseDur=v=>{ v=(v||'').trim(); if(!v) return null; const m=v.match(/^(\d+)(?::(\d{1,2}))?$/); if(!m) return undefined; return m[2]!==undefined? (+m[1])*60+(+m[2]) : (+m[1])*60; };
const clampInt=(v,lo,hi,dflt)=>{ v=Math.round(+v); return Number.isFinite(v)&&v>=lo ? Math.min(hi,v) : dflt; };
const batchim=w=>{ const k=w.charCodeAt(w.length-1)-0xAC00; return k>=0&&k<11172&&k%28>0; };
const eunNeun=w=>w+(batchim(w)?'은':'는');   // 받침에 맞춘 은/는
const eulReul=w=>w+(batchim(w)?'을':'를');   // 받침에 맞춘 을/를
const UI_STORE='maple-web-timer-ui';
let ui={}; try{ ui=JSON.parse(localStorage.getItem(UI_STORE)||'{}'); }catch(e){}
function saveUi(){ try{ localStorage.setItem(UI_STORE,JSON.stringify(ui)); }catch(e){} }
if(typeof module==='object') module.exports={fmt,parseDur,clampInt,batchim,eunNeun,eulReul};   // node 테스트용. 브라우저에서는 무시됨
