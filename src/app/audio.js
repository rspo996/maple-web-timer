/* ===== 음량 0~200% (묶음 5). 비프·내 소리는 마스터 GainNode 한 곳에서 키우고, 100%를 넘을 때만 리미터를 거친다.
   음성(TTS)은 Web Audio로 키울 수 없어 100%에서 멈춘다(ttsVolume) ===== */
import {Alerts,beep,unlockAudio} from './alerts.js';
import {bump} from './bus.js';
import {saveUi,ui} from './prefs.js';
import {clampVolumePct,volumeToGain} from '../core/util.js';
export let master=null, limiter=null, limiterOn=null;
export const vol={pct:80};   // 음량 슬라이더의 지금 값(드래그 중 포함). 저장값은 손을 뗄 때 ui.volumePct에
export const volPct=()=>vol.pct;
export const voiceOn=()=>ui.voice!==false;
export function applyVolume(){
  const pct=volPct(); bump();   // 음량 글자와 "음성은 100%까지" 안내
  if(!master) return;
  master.gain.setTargetAtTime(volumeToGain(pct),master.context.currentTime,0.01);   // 딱 소리 없이 바꾼다
  const want=pct>100;                      // 100% 이하는 Gain만(이전과 같은 크기). 넘으면 클리핑을 막는 리미터
  if(want!==limiterOn){ master.disconnect(); master.connect(want?limiter:master.context.destination); limiterOn=want; }
}
// 드래그 중에는 소리를 내지 않는다
export function previewVolume(raw){ vol.pct=clampVolumePct(raw); applyVolume(); }
// 손을 떼면 저장하고 확인음 한 번
export function commitVolume(raw){ vol.pct=clampVolumePct(raw); ui.volumePct=vol.pct; saveUi(); unlockAudio(); applyVolume(); beep('buff'); }
export function setVoice(on){ ui.voice=on; saveUi(); bump(); }
export function buildMaster(ctx){
  master=ctx.createGain(); master.gain.value=volumeToGain(volPct());
  limiter=ctx.createDynamicsCompressor();
  limiter.threshold.value=-3; limiter.knee.value=0; limiter.ratio.value=20; limiter.attack.value=0.003; limiter.release.value=0.1;   // 출발점 [추정]. 청취로 조정
  limiter.connect(ctx.destination); limiterOn=null;
  Alerts.setAudioOut(master); applyVolume();
}
export function audioInit(){
  vol.pct=clampVolumePct(ui.volumePct);
  Alerts.onAudioReady(buildMaster);
  applyVolume();
}
