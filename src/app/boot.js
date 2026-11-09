/* 엔진 부팅: 화면(React)이 처음 그려진 뒤 App이 boot()를 한 번 부른다. 다른 모듈은 정의와 init*()만 둔다 */
import '../core/idle.js';          // import하면 KINDS.idle이 등록된다. initTargets()가 저장소를 읽기 전에 모든 종류가 있어야 한다
import '../core/cooldown.js';      // KINDS.cooldown
import './dev-globals.js';
import {setHooks} from '../core/hooks.js';
import {Alerts} from './alerts.js';
import {initCapture,src} from './capture.js';
import {detectTemplate,loadTpl,readTimer,tick} from './detect-run.js';
import {$} from './dom.js';
import {manualInit,manualTick} from './manual.js';
import {audioInit} from './audio.js';
import {pipInit} from './pip.js';
import {ui} from './prefs.js';
import {initRegister} from './register.js';
import {initSounds} from './sounds.js';
import {initTargets,store} from './store.js';
import {initCards,onTargetChanged} from './ui-cards.js';
import {renderWatch,setNote} from './ui-watch.js';

function onWorkerTick(){
  manualTick(Date.now());   // 수동 타이머는 감지 tick의 busy·grabFrame 대기에 묶이지 않게 먼저 동기로
  tick();
  Alerts.flush(Date.now()); // busy로 tick이 건너뛰어진 메시지에서도 묶기 대기열을 비운다
}
let booted=false;
export function boot(){
  if(booted) return; booted=true;
  // 순수 계산 쪽(core)이 부르는 화면·캡처 기능
  setHooks({setNote,onTargetChanged,detectTemplate,readTimer,loadTpl,hasSource:()=>!!src});
  initTargets(); initCapture(); initRegister(); initCards(); initSounds();
  manualInit(); audioInit(); pipInit();
  renderWatch();
  $('#helpDetails').open = !(ui.connectedOnce || store.targets.some(t=>t.tpl));   // 처음에만 펼침
  try{
    // 숨은 탭에서도 500ms 간격을 지키도록 Worker 타이머를 쓴다
    const wk=new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),500)'],{type:'text/javascript'})));
    wk.onmessage=onWorkerTick;
  }catch(e){ setInterval(onWorkerTick,500); }
}
