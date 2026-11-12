/* ===== 묶음 7: 버전 표시·새 버전 안내. 빌드 상수 __APP_VERSION__(vite.config.js)과 배포된 version.json을 비교해,
   다르면 상태줄에 "새 버전이 있어요"를 조용히 띄운다(소리·음성·브라우저 알림 없음). 새로고침은 사용자가 버튼으로 한다 ===== */
import {bump} from './bus.js';
import {src} from './capture.js';
import {VERSION_GAP,isOtherVersion,shouldCheck} from '../core/version-core.js';
const CUR=typeof __APP_VERSION__!=='undefined'&&__APP_VERSION__&&typeof __APP_VERSION__.id==='string'?__APP_VERSION__:{id:'dev',sha:'',builtAt:''};
// cur: 이 탭의 버전, found: 다른 버전을 찾았음(새로고침할 때까지 유지), lastAt: 마지막으로 받기 시작한 시각(앱을 연 시각에서 시작)
export const versionState={cur:CUR,found:false,lastAt:Date.now()};
const base=()=>import.meta.env.BASE_URL||'./';
// version.json을 한 번 받아 비교한다. 실패(오프라인·404·JSON 아님)는 조용히 넘기고 다음 계기에 다시 받는다
export async function checkVersion(){
  versionState.lastAt=Date.now();
  try{
    const r=await fetch(base()+'version.json',{cache:'no-store'}); if(!r.ok) return;
    const remote=await r.json();
    if(!versionState.found&&isOtherVersion(versionState.cur,remote)){ versionState.found=true; bump(); }
  }catch(e){}
}
function maybeCheck(gap){
  if(shouldCheck({hidden:document.hidden,found:versionState.found,now:Date.now(),lastAt:versionState.lastAt,gap})) checkVersion();
}
// 자동 확인: 1분마다 물어 마지막 확인에서 5분 지났으면, 탭이 다시 보일 때는 60초 지났으면 받는다. 숨은 탭에서는 받지 않는다
let watching=false;
export function startVersionWatch(){
  if(watching) return; watching=true;
  setInterval(()=>maybeCheck(VERSION_GAP.interval),60_000);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) maybeCheck(VERSION_GAP.visible); });
}
// 개발 서버(id 'dev')에는 version.json이 없으므로 자동 확인을 걸지 않는다(시험은 startVersionWatch·checkVersion을 직접 부른다)
export function initVersion(){ if(versionState.cur.id!=='dev') startVersionWatch(); }
export const RELOAD_CONFIRM='새로고침하면 화면 공유가 끊겨요. “게임 화면 연결”을 다시 눌러야 해요. 새로고침할까요?';
// 상태줄의 [새로고침]. 화면 공유 중이면 끊긴다고 먼저 묻는다(대상 삭제와 같은 브라우저 확인 창)
export function reloadForUpdate(){
  if(src&&src.type==='stream'&&!confirm(RELOAD_CONFIRM)) return;
  location.reload();
}
