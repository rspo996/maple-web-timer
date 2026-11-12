/* ===== 묶음 7: 버전 표시·새 버전 안내의 순수 계산. 버전 값은 인자로만 받는다(빌드 상수 __APP_VERSION__은 src/app/version.js가 읽는다) =====
   버전 객체: {id, sha, builtAt}. id는 빌드마다 다르고, 개발 서버는 id 'dev'다(vite.config.js) */
export const VERSION_GAP={interval:5*60_000,visible:60_000};   // 보이는 동안 5분마다, 탭이 다시 보일 때는 마지막 확인에서 60초 지났으면
const isDev=v=>!v||v.id==='dev'||!v.builtAt;
const two=n=>String(n).padStart(2,'0');
// 헤더의 버전 글자: "18202a6 · 11월 12일 12:25"(지역 시각). 커밋 값이 없으면 시각만, 개발 서버면 "개발 중"
export function versionLabel(v){
  if(isDev(v)) return '개발 중';
  const d=new Date(v.builtAt); if(isNaN(d)) return v.sha||'개발 중';
  const when=`${d.getMonth()+1}월 ${d.getDate()}일 ${two(d.getHours())}:${two(d.getMinutes())}`;
  return v.sha?`${v.sha} · ${when}`:when;
}
// 받은 version.json이 지금 버전과 다른가. 모양이 맞지 않으면(빈 id, 숫자, 배열, 404 페이지 등) 새 버전으로 보지 않는다
export function isOtherVersion(cur,remote){
  if(!remote||typeof remote!=='object'||Array.isArray(remote)) return false;
  if(typeof remote.id!=='string'||!remote.id) return false;
  return !cur||remote.id!==cur.id;
}
// 지금 version.json을 받을까: 숨은 탭·이미 찾음이면 아니고, 마지막 확인에서 gap이 지났을 때만(개발 서버는 initVersion이 자동 확인을 걸지 않는다)
export function shouldCheck({hidden,found,now,lastAt,gap}){
  if(hidden||found) return false;
  return now-lastAt>=gap;
}
