/* ----- 실행 중 저장소. 소유: 이 파일. 다른 파일은 store.targets를 읽고, 바꾼 뒤에는 saveTargets()를 부른다 ----- */
import {importing} from './prefs.js';
import {setNote} from './ui-watch.js';
import {defaultGroup,loadStore,saveStore} from '../core/targets.js';
export let store={ver:2,seq:0,targets:[],group:defaultGroup()}, storeStatus='fresh';   // initTargets()가 채운다(모든 종류가 KINDS에 등록된 뒤 main.js가 부른다)
export const targetById=id=>store.targets.find(t=>t.id===id);
export let saveWarned=false;
export function saveTargets(){
  if(importing) return;   // 백업을 불러와 새로고침하기 전까지 쓰지 않는다
  if(saveStore(store)||saveWarned) return;
  saveWarned=true; setNote('설정을 저장하지 못했어요 (이 탭에서만 유지)');
}
export function initTargets(){
  const r=loadStore(); store=r.store; storeStatus=r.status;
  if(r.status==='broken') setNote('설정을 읽지 못해 처음 상태로 시작했어요. 백업 파일이 있으면 불러오세요');
  else if(r.saveFailed){ saveWarned=true; setNote('설정을 저장하지 못했어요 (이 탭에서만 유지)'); }
}
