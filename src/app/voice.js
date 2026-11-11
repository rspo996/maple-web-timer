/* ===== 묶음 6: 미리 만든 Gemini 음성 재생. 목록(public/voice/manifest.json)과 고른 목소리의 파일을 받아 풀어 두고, alerts.js의 speakClip이 꺼내 쓴다 ===== */
import {actx,speak,spokenAt} from './alerts.js';
import {bump} from './bus.js';
import {manual} from './manual.js';
import {saveUi,ui} from './prefs.js';
import {store} from './store.js';
import {DEFAULT_VOICE,VOICE_SAMPLE,voiceCoverage,voicePhrases} from '../core/voice-phrases.js';
export const voiceState={manifest:null,status:'loading',clips:new Map(),failed:new Set(),run:null};   // status: loading|ok|none
const base=()=>import.meta.env.BASE_URL||'./';
export const voiceFileUrl=f=>/^(data:|blob:|https?:)/.test(f)?f:base()+'voice/'+f;
export const voiceIds=()=>voiceState.manifest?voiceState.manifest.voices.map(v=>v.id):[];
// 고른 목소리. 'browser'는 브라우저 기본 음성. 목록에 없으면 기본(Erinome), 목록이 없으면 브라우저
export function currentVoice(){
  if(ui.voiceName==='browser') return 'browser';
  const ids=voiceIds(); if(ids.includes(ui.voiceName)) return ui.voiceName;
  return ids.includes(DEFAULT_VOICE)?DEFAULT_VOICE:(ids[0]||'browser');
}
export function setVoiceManifest(m){
  voiceState.manifest=m&&m.version===1&&Array.isArray(m.voices)&&m.voices.every(v=>v&&typeof v.id==='string')&&m.files&&typeof m.files==='object'?m:null;
  voiceState.status=voiceState.manifest?'ok':'none'; voiceState.clips.clear(); voiceState.failed.clear(); voiceState.run=null; bump(); loadClips();
}
export async function initVoice(){
  try{ const r=await fetch(base()+'voice/manifest.json',{cache:'no-cache'}); if(!r.ok) throw new Error('HTTP '+r.status); setVoiceManifest(await r.json()); }
  catch(e){ setVoiceManifest(null); }
}
export function setVoiceName(name){ ui.voiceName=name; saveUi(); voiceState.clips.clear(); voiceState.failed.clear(); voiceState.run=null; bump(); loadClips(); }
async function decode(f){ const r=await fetch(voiceFileUrl(f)); if(!r.ok) throw new Error('HTTP '+r.status); return actx.decodeAudioData(await r.arrayBuffer()); }
// 고른 목소리의 파일만 차례로 받아 푼다. 목소리를 바꾸면 하던 것을 그만둔다. 오디오가 켜지기 전이면 unlockAudio가 다시 부른다
export async function loadClips(){
  const v=currentVoice(); if(!actx||!voiceState.manifest||v==='browser') return;
  if(voiceState.run&&voiceState.run.description===v) return;
  const run=Symbol(v); voiceState.run=run; let added=0;
  for(const [text,f] of Object.entries(voiceState.manifest.files[v]||{})){
    if(voiceState.run!==run) return;
    const key=v+'/'+text; if(voiceState.clips.has(text)||voiceState.failed.has(key)) continue;
    try{ const b=await decode(f); if(voiceState.run===run){ voiceState.clips.set(text,b); added++; } }catch(e){ voiceState.failed.add(key); }   // 못 풀면 그 문구는 브라우저 음성
  }
  if(voiceState.run===run){ voiceState.run=null; if(added) bump(); }
}
export const clipFor=text=>currentVoice()==='browser'?null:(voiceState.clips.get(text)||null);
// 소리 설정의 "듣기": 아직 안 풀렸으면 그 문구만 먼저 풀어서 바로 들려준다
export async function previewVoice(){
  const v=currentVoice(), f=v!=='browser'&&voiceState.manifest&&(voiceState.manifest.files[v]||{})[VOICE_SAMPLE];
  if(f&&actx&&!voiceState.clips.has(VOICE_SAMPLE)){ try{ const b=await decode(f); if(currentVoice()===v) voiceState.clips.set(VOICE_SAMPLE,b); }catch(e){} }
  spokenAt.delete(VOICE_SAMPLE); speak(VOICE_SAMPLE);
}
export function voiceChoices(){
  const vs=voiceState.manifest?voiceState.manifest.voices:[];
  return [...vs.map(v=>({id:v.id,text:`${v.label}${v.id===DEFAULT_VOICE?' (기본)':''} · ${v.gender}`})),{id:'browser',text:'브라우저 기본 음성'}];
}
export function voiceNote(){
  if(voiceState.status==='loading') return 'Gemini 음성 목록을 읽는 중이에요';
  if(voiceState.status==='none') return 'Gemini 음성 파일이 없어서 브라우저 음성으로 말해요';
  const v=currentVoice(); if(v==='browser') return '브라우저 기본 음성으로 말해요';
  const c=voiceCoverage(voicePhrases({targets:store.targets,group:store.group,manual}),voiceState.manifest.files[v]);
  return `Gemini 음성 ${c.have}개 · 브라우저 음성 ${c.missing.length}개`+(c.missing.length?' · 음성 파일이 아직 없는 문구는 브라우저 음성으로 나와요':'');
}
