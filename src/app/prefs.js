/* 화면 설정(음량·펼침 상태·작은 창 크기 등) 저장과, 백업을 불러오는 동안 모든 저장을 막는 표시 */
export const UI_STORE='maple-web-timer-ui';
export let ui={}; try{ ui=JSON.parse(localStorage.getItem(UI_STORE)||'{}'); }catch(e){}
export let importing=false;   // 백업을 불러와 새로고침하기 전까지 모든 저장을 막는다(묶음 5)
export function saveUi(){ if(importing) return; try{ localStorage.setItem(UI_STORE,JSON.stringify(ui)); }catch(e){} }
export function setImporting(v){ importing=v; }
