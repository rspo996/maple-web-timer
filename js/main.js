/* 부팅: 이 파일만 최상위에서 코드를 실행한다 */
loadLegacyStore(); initStates(); initCapture(); initRegister();
buildCards(); renderWatch(); buildSounds(); loadSounds();
$('#helpDetails').open = !(ui.connectedOnce || DEFS.some(d=>cfgs[d.id].tpl));   // 처음에만 펼침
try{
  const wk=new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),500)'],{type:'text/javascript'})));
  wk.onmessage=tick;
}catch(e){ setInterval(tick,500); }
