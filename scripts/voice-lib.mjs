/* ===== 묶음 6: 음성 생성 스크립트의 순수 함수(node 전용). API 호출·파일 쓰기는 voice-gen.mjs ===== */
import {createHash} from 'node:crypto';
import * as lame from '@breezystack/lamejs';
import {VOICES,VOICE_MODEL,VOICE_STYLE} from '../src/core/voice-phrases.js';

export const TTS_URL='https://generativelanguage.googleapis.com/v1beta/interactions';
// 문서(2026-11-10 기준)의 Interactions API 모양. 첫 실제 호출에서 확인한다
export function buildTtsRequest({text,voice,key,model=VOICE_MODEL,style=VOICE_STYLE}){
  const body={model,input:[{type:'user_input',content:[{type:'text',text,annotations:[{type:'speech_metadata',style}]}]}],
    response_format:{type:'audio'},generation_config:{speech_config:[{voice}]}};
  return {url:TTS_URL,init:{method:'POST',headers:{'x-goog-api-key':key,'Content-Type':'application/json'},body:JSON.stringify(body)}};
}
// 응답에서 base64 오디오. Interactions(steps[].content[] type audio)와 generateContent(candidates[].content.parts[].inlineData) 모두
export function extractAudioBase64(j){
  for(const s of (j&&j.steps)||[]) for(const c of s.content||[]) if(c&&c.type==='audio'&&c.data) return c.data;
  for(const c of (j&&j.candidates)||[]) for(const p of (c.content&&c.content.parts)||[]) if(p&&p.inlineData&&p.inlineData.data) return p.inlineData.data;
  throw new Error('응답에 음성이 없어요: '+JSON.stringify(j).slice(0,300));
}
const int16At=(u,off,len)=>{ const n=len>>1, out=new Int16Array(n), dv=new DataView(u.buffer,u.byteOffset+off,n*2); for(let i=0;i<n;i++) out[i]=dv.getInt16(i*2,true); return out; };
// WAV(RIFF)면 헤더를 읽고, 아니면 헤더 없는 24kHz 모노 16비트(리틀 엔디언) PCM으로 본다
export function pcmFromAudio(buf){
  const u=buf instanceof Uint8Array?buf:new Uint8Array(buf), dv=new DataView(u.buffer,u.byteOffset,u.byteLength);
  const tag=o=>String.fromCharCode(u[o],u[o+1],u[o+2],u[o+3]);
  if(u.length>=12&&tag(0)==='RIFF'&&tag(8)==='WAVE'){
    let o=12, rate=24000, ch=1, bits=16, data=null;
    while(o+8<=u.length){ const id=tag(o), size=dv.getUint32(o+4,true), body=o+8;
      if(id==='fmt '){ ch=dv.getUint16(body+2,true); rate=dv.getUint32(body+4,true); bits=dv.getUint16(body+14,true); }
      else if(id==='data'){ data=[body,Math.min(size,u.length-body)]; break; }
      o=body+size+(size&1); }
    if(!data) throw new Error('WAV에 data 덩어리가 없어요');
    if(ch!==1||bits!==16) throw new Error(`모노 16비트 WAV만 받아요(지금 ${ch}채널 ${bits}비트)`);
    return {sampleRate:rate,samples:int16At(u,data[0],data[1])};
  }
  return {sampleRate:24000,samples:int16At(u,0,u.length)};
}
// 모노 MP3 96kbps 기본. 48kbps에서 ㅅ·ㅊ·ㅈ 고음이 지지직거린다는 보고(2026-11-11). 1152샘플씩 넣는다
export function encodeMp3(samples,sampleRate,kbps=96){
  const enc=new lame.Mp3Encoder(1,sampleRate,kbps), parts=[];
  for(let i=0;i<samples.length;i+=1152){ const b=enc.encodeBuffer(samples.subarray(i,i+1152)); if(b.length) parts.push(b); }
  const end=enc.flush(); if(end.length) parts.push(end);
  const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0)); let o=0;
  for(const p of parts){ out.set(new Uint8Array(p.buffer,p.byteOffset,p.length),o); o+=p.length; }
  return out;
}
// 오류 본문의 "retry in 8s" / "retry in 12.5 s"를 밀리초로. 없으면 null
export function retryAfterMs(body){ const m=/retry\s+in\s+(\d+(?:\.\d+)?)\s*s/i.exec(String(body)); return m?Math.ceil(parseFloat(m[1])*1000):null; }
export function parseEnvKey(text){ const m=/^[ \t]*(?:export[ \t]+)?GEMINI_API_KEY[ \t]*=[ \t]*["']?([^"'\s#]+)/m.exec(String(text)); return m?m[1]:null; }
export const clipPath=(voice,text)=>`${voice}/${createHash('sha1').update(text).digest('hex').slice(0,12)}.mp3`;
export function emptyManifest(){ return {version:1,model:VOICE_MODEL,style:VOICE_STYLE,voices:VOICES.map(v=>({...v})),files:{}}; }
// 저장된 manifest를 이어서 쓴다. 모델·말투가 바뀌었으면 처음부터(다른 소리가 섞이지 않게)
export function adoptManifest(j){
  const m=emptyManifest();
  if(j&&j.version===1&&j.model===VOICE_MODEL&&j.style===VOICE_STYLE&&j.files&&typeof j.files==='object') m.files=j.files;
  return m;
}
export const manifestGet=(m,voice,text)=>(m.files[voice]&&m.files[voice][text])||null;
export function manifestSet(m,voice,text,rel){ (m.files[voice]=m.files[voice]||{})[text]=rel; }
// 명령줄 옵션 해석. 모르는 옵션·값 빠짐·잘못된 --limit은 던진다(오타가 전체 생성으로 번지지 않게). npm이 --dry-run을 가져간 경우도 알아본다
export function parseArgs(argv,env){
  const r={backup:null,voices:null,limit:null,dryRun:false,hint:null}, vals=['--backup','--voices','--limit'];
  for(let i=0;i<argv.length;i++){
    let a=argv[i], v;
    const eq=a.indexOf('='); if(a.startsWith('--')&&eq>0&&vals.includes(a.slice(0,eq))){ v=a.slice(eq+1); a=a.slice(0,eq); }
    if(a==='--dry-run'&&v===undefined){ r.dryRun=true; continue; }
    if(!vals.includes(a)) throw new Error(`모르는 옵션: ${argv[i]} (쓸 수 있는 것: --backup 파일, --voices Erinome,Zephyr, --limit N, --dry-run)`);
    if(v===undefined){ const n=argv[i+1]; if(n===undefined||n.startsWith('--')) throw new Error(`${a} 뒤에 값을 주세요`); v=n; i++; }
    if(v==='') throw new Error(`${a} 뒤에 값을 주세요`);
    if(a==='--backup') r.backup=v;
    else if(a==='--voices') r.voices=[...new Set(v.split(',').map(s=>s.trim()).filter(Boolean))];
    else{ if(!/^\d+$/.test(v)||+v<1) throw new Error('--limit은 1 이상의 정수로 주세요'); r.limit=+v; }
  }
  if(env&&env.npm_config_dry_run==='true'){ r.dryRun=true; r.hint='npm이 --dry-run을 가져갔어요. 다음부터는 npm run voice -- --dry-run 처럼 -- 뒤에 옵션을 주세요'; }
  return r;
}
