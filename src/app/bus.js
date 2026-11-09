/* 화면 갱신 신호. 엔진(감지 틱·수동 타이머·설정 변경)이 상태를 바꾼 뒤 bump()를 부르면 구독한 React 컴포넌트가 다시 그린다.
   - 엔진 상태는 객체를 직접 바꾸는 방식이라, 컴포넌트는 버전 번호(version)만 보고 다시 그린 뒤 상태를 직접 읽는다(ui/useBus.js).
   - bump() 직후 DOM이 맞춰져 있도록 React 쪽이 flushSync를 꽂는다(setFlush). 바꾼 뒤 바로 focus하는 코드 등이 그대로 동작한다.
   - 탭이 숨겨져 있으면 그리지 않고 표시만 해 두었다가 다시 보일 때 한 번 그린다(사냥 중에는 탭이 숨겨져 있다).
   - batch(fn) 안의 bump()는 끝날 때 한 번으로 모은다(감지 틱처럼 여러 곳이 바뀌는 경우) */
let ver=0, depth=0, dirty=false, flush=fn=>fn();
const subs=new Set();
export function setFlush(f){ flush=f; }
export function subscribe(fn){ subs.add(fn); return ()=>subs.delete(fn); }
export const version=()=>ver;
export function bump(){
  ver++;
  if(depth||document.hidden){ dirty=true; return; }
  dirty=false; flush(()=>{ for(const fn of [...subs]) fn(); });
}
export function batch(fn){
  depth++;
  try{ return fn(); }
  finally{ if(--depth===0&&dirty) bump(); }
}
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&dirty) bump(); });
