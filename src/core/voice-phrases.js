/* ===== 묶음 6: Gemini 음성으로 미리 만들 문구 목록 (순수). 문구는 직접 쓰지 않고 앱의 문구 함수를 불러, 실제로 말하는 문구와 글자까지 같게 한다 ===== */
import {groupText} from './alerts-core.js';
import './cooldown.js';                                   // 설치기 종류 등록
import {IDLE_ALERTS} from './idle.js';                    // 사냥 멈춤 종류 등록 + 알림 횟수
import {KINDS,sayName} from './kinds.js';
import {manualEmptyStore,manualText,presetTimerName} from './manual-core.js';
import {defaultStore} from './targets.js';

// 무료 키는 이 모델에서 하루 10개라(2026-11-11 확인) 기본 목소리만 만든다.
// 다른 목소리는 소리 설정의 '알림 소리 바꾸기'에서 알림마다 음성 파일을 골라 쓴다(사용자 결정)
export const VOICES=[{id:'Erinome',label:'Erinome',gender:'여'}];
export const DEFAULT_VOICE='Erinome';                        // 사용자 결정(2026-11-11): 기본은 Erinome, 목소리는 모두 여자
export const VOICE_MODEL='gemini-3.8-flash-tts';
export const VOICE_STYLE='Friendly, bright and natural young Korean woman, like a cheerful game guide. Warm smile in the voice. Say only the given text.';   // 한국어 대본이어도 말투 지시는 영어가 좋다(문서)
export const WATCH_START='감시 시작할게요';
export const VOICE_SAMPLE='야누스 곧 꺼져요';             // 소리 설정의 "듣기"

const perms=(arr,k)=>k===0?[[]]:arr.flatMap((x,i)=>perms([...arr.slice(0,i),...arr.slice(i+1)],k-1).map(p=>[x,...p]));
const preOf=t=>KINDS[t.kind]&&KINDS[t.kind].events.find(e=>e.group==='pre');
const hasPre=t=>!!preOf(t)&&!(t.kind==='cooldown'&&!t.p.durationSec);

// 대상 하나가 말할 수 있는 문구
function targetTexts(t){
  const k=KINDS[t.kind]; if(!k) return [];
  const out=[];
  for(const e of k.events){
    if(t.kind==='idle'&&e.key==='alarm'){   // 처음 + 반복(경과 시간이 문구에 들어간다)
      for(let i=0;i<IDLE_ALERTS&&(i===0||t.p.repeatSec>0);i++) out.push(e.msg(t,{elapsedSec:t.p.idleSec+i*t.p.repeatSec}));
      continue;
    }
    if(t.kind==='cooldown'&&e.key==='pre'&&!t.p.durationSec) continue;   // 지속시간이 없으면 울리지 않는다
    out.push(e.msg(t,{}));
  }
  return out;
}
// 묶음 미리 알림: 실행 중 남은 시간에 따라 순서가 바뀌므로 모든 순서를 만든다. 4개 이상이면 "N개 곧 꺼져요"
function groupTexts(targets){
  const names=targets.filter(hasPre).map(sayName), out=[];
  const say=arr=>groupText('pre',arr.map((label,i)=>({label,rank:i,order:i})));
  for(const p of perms(names,2)) out.push(say(p));
  if(names.length<=3) for(const p of perms(names,3)) out.push(say(p));
  for(let n=4;n<=names.length;n++) out.push(say(names.slice(0,n)));
  return out;
}
// 수동 타이머: 프리셋으로 시작할 타이머, 기본 사냥·회수 반복, 저장된 타이머
function manualTexts(m){
  const pre=(m.prefs&&m.prefs.preSec)||10, out=[];
  const count=(t,all)=>out.push(manualText(t,{type:'pre',idx:0},all),manualText(t,{type:'end',idx:0},all));
  const routine=(t,all)=>{ for(let i=0;i<t.phases.length;i++) out.push(manualText(t,{type:'pre',idx:i},all),manualText(t,{type:'switch',idx:i},all)); };
  for(const p of m.presets||[]){ const label=presetTimerName(p), t={kind:'countdown',label,preSec:pre,phases:[{name:label,sec:p.sec}]}; count(t,[t]); }
  const r={kind:'routine',label:'사냥·회수',preSec:pre,phases:[{name:'사냥',sec:60},{name:'회수',sec:60}]}; routine(r,[r]);
  const timers=m.timers||[];
  for(const t of timers) (t.kind==='routine'?routine:count)(t,timers);
  return out;
}
// targets: 대상 배열(꺼 둔 대상 포함), group: {on}, manual: 수동 타이머 저장값. 없으면 기본 설정
export function voicePhrases({targets,group,manual}={}){
  const ts=targets||defaultStore().targets, m=manual||manualEmptyStore();
  const all=[WATCH_START,...ts.flatMap(targetTexts),...(group&&group.on?groupTexts(ts):[]),...manualTexts(m)];
  return [...new Set(all)].sort();
}
// files: manifest.files[목소리] (문구 → 파일). 없는 문구는 브라우저 음성으로 나온다
export function voiceCoverage(phrases,files){
  const f=files||{}, missing=phrases.filter(p=>!f[p]);
  return {have:phrases.length-missing.length,missing};
}
