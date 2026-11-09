/* 부팅: 이 파일만 최상위에서 코드를 실행한다. 다른 파일은 정의와 init*()만 둔다 */
// 필수 전역이 하나라도 없으면(파일 누락) 빈 화면 대신 어느 파일이 빠졌는지 보여준다
const REQUIRED={ 'js/util.js':'parseDur','js/match.js':'matchTemplate','js/detect-core.js':'stepDetector','js/preset-data.js':'PRESET_ICONS','js/targets.js':'loadStore',
  'js/kinds.js':'KINDS','js/alerts.js':'Alerts','js/sounds.js':'loadSounds','js/capture.js':'grab','js/detect-run.js':'tick','js/ui-watch.js':'renderWatch',
  'js/ui-cards.js':'buildCards','js/register.js':'startRegister' };
function missingFiles(){ return Object.keys(REQUIRED).filter(f=>{ try{ return typeof eval(REQUIRED[f])==='undefined'; }catch(e){ return true; } }); }
function onWorkerTick(){
  if(typeof manualTick==='function') manualTick(Date.now());   // 묶음 2: 수동 타이머는 감지 tick의 busy·grabFrame 대기에 묶이지 않게 먼저 동기로
  tick();
  Alerts.flush(Date.now());                                    // busy로 tick이 건너뛰어진 메시지에서도 묶기 대기열을 비운다
}
(function boot(){
  const miss=missingFiles();
  if(miss.length){ const e=$('#empty'); if(e) e.textContent='파일이 빠졌어요: '+miss.join(', '); return; }
  initTargets(); initCapture(); initRegister(); initCards(); initSounds();
  for(const f of ['manualInit','audioInit','pipInit','backupInit']) if(typeof globalThis[f]==='function') globalThis[f]();   // 묶음 2·5가 파일을 더하면 여기서 부른다
  renderWatch();
  $('#helpDetails').open = !(ui.connectedOnce || store.targets.some(t=>t.tpl));   // 처음에만 펼침
  try{
    const wk=new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),500)'],{type:'text/javascript'})));
    wk.onmessage=onWorkerTick;
  }catch(e){ setInterval(onWorkerTick,500); }
})();
