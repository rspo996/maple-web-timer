export const $=s=>document.querySelector(s);
export const setText=(el,txt)=>{ if(el.textContent!==txt) el.textContent=txt; };   // 같은 값이면 DOM을 건드리지 않는다(작은 창처럼 React 밖에서 그리는 곳)
