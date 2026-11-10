/* ===== 묶음 6: 알림 문구를 Gemini 음성(MP3)으로 미리 만든다
   사용: npm run voice -- [--backup 설정백업.json] [--voices Kore,Zephyr] [--limit N] [--dry-run]
   API 키: 저장소 맨 위 .env.gemini 의 GEMINI_API_KEY=… (git에서 빠져 있다). 키는 출력하지 않는다 ===== */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateBackup} from '../src/core/backup-core.js';
import {VOICES,voicePhrases} from '../src/core/voice-phrases.js';
import {parseArgs,adoptManifest,buildTtsRequest,clipPath,encodeMp3,extractAudioBase64,manifestGet,manifestSet,parseEnvKey,pcmFromAudio} from './voice-lib.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), OUT=path.join(ROOT,'public','voice'), MANIFEST=path.join(OUT,'manifest.json');
let a; try{ a=parseArgs(process.argv.slice(2),process.env); }catch(e){ console.error(e.message); process.exit(1); }
if(a.hint) console.log(a.hint);

let input={};
if(a.backup){
  let v; try{ v=validateBackup(JSON.parse(fs.readFileSync(a.backup,'utf8'))); }catch(e){ console.error(`설정 백업 파일을 읽지 못했어요: ${e.message}`); process.exit(1); }
  if(!v.ok){ console.error('설정 백업 파일을 읽지 못했어요: '+v.errors.join(', ')); process.exit(1); }
  const st=v.groups.targets; input={targets:st&&st.targets,group:st&&st.group,manual:v.groups.manualTimers};
}
const phrases=voicePhrases(input);
const ids=a.voices||VOICES.map(v=>v.id);
const unknown=ids.filter(id=>!VOICES.some(v=>v.id===id)); if(unknown.length){ console.error('모르는 목소리: '+unknown.join(', ')); process.exit(1); }
let old=null;
if(fs.existsSync(MANIFEST)){
  try{ old=JSON.parse(fs.readFileSync(MANIFEST,'utf8')); }
  catch(e){ console.log('manifest.json이 깨져 있어서 처음부터 만들어요'); old=null; }
}
const manifest=adoptManifest(old);
const countFiles=m=>Object.values((m&&m.files)||{}).reduce((n,v)=>n+Object.keys(v||{}).length,0);
if(old&&countFiles(old)>0&&countFiles(manifest)===0) console.log(`모델·말투가 바뀌어서 기존 음성 ${countFiles(old)}개를 버리고 처음부터 만들어요`);
// 매니페스트는 임시 파일에 쓴 뒤 바꿔치기해서, 쓰다 멈춰도 깨지지 않게 한다
const saveManifest=()=>{ fs.writeFileSync(MANIFEST+'.tmp',JSON.stringify(manifest,null,1)); fs.renameSync(MANIFEST+'.tmp',MANIFEST); };
let todo=[];
for(const voice of ids) for(const text of phrases){ const rel=manifestGet(manifest,voice,text); if(!rel||!fs.existsSync(path.join(OUT,rel))) todo.push({voice,text}); }
if(a.limit) todo=todo.slice(0,a.limit);
console.log(`문구 ${phrases.length}개 × 목소리 ${ids.length}개 · 새로 만들 것 ${todo.length}개`);
if(a.dryRun){ for(const p of phrases) console.log('  '+p); process.exit(0); }

const envFile=path.join(ROOT,'.env.gemini'), key=fs.existsSync(envFile)?parseEnvKey(fs.readFileSync(envFile,'utf8')):null;
if(!key){ console.error('API 키가 없어요. https://aistudio.google.com/apikey 에서 키를 만들어 저장소 맨 위 .env.gemini 파일에 GEMINI_API_KEY=키 한 줄로 넣어 주세요'); process.exit(1); }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function synth(text,voice){
  for(let attempt=0;;attempt++){
    const {url,init}=buildTtsRequest({text,voice,key});   // init에는 API 키가 들어 있으니 출력하지 않는다. init이나 key를 어디에도 로그로 남기지 말 것
    let res;
    try{ res=await fetch(url,init); }
    catch(e){   // 네트워크 오류도 같은 식으로 다시 해 본다. 메시지에는 init·키를 넣지 않는다
      const code=(e.cause&&e.cause.code)||e.code||'알 수 없음';
      if(attempt<5){ console.log(`  네트워크 오류(${code}), ${2*2**attempt}초 뒤 다시`); await sleep(2000*2**attempt); continue; }
      throw new Error(`네트워크 오류(${code}): ${e.message}`);
    }
    if(res.ok) return extractAudioBase64(await res.json());
    const body=await res.text();
    if((res.status===429||res.status>=500)&&attempt<5){ console.log(`  HTTP ${res.status}, ${2*2**attempt}초 뒤 다시`); await sleep(2000*2**attempt); continue; }
    const e=new Error(`HTTP ${res.status}: ${body.slice(0,500)}`); e.status=res.status; throw e;
  }
}
fs.mkdirSync(OUT,{recursive:true});
let done=0;
for(const {voice,text} of todo){
  try{
    const pcm=pcmFromAudio(Buffer.from(await synth(text,voice),'base64'));
    if(pcm.samples.length<pcm.sampleRate*0.2) throw new Error(`음성이 너무 짧아요(${(pcm.samples.length/pcm.sampleRate).toFixed(2)}초)`);
    const rel=clipPath(voice,text); fs.mkdirSync(path.join(OUT,voice),{recursive:true});
    fs.writeFileSync(path.join(OUT,rel),encodeMp3(pcm.samples,pcm.sampleRate));
    manifestSet(manifest,voice,text,rel); saveManifest();   // 하나 만들 때마다 저장(중간에 멈춰도 이어서)
    done++; console.log(`[${done}/${todo.length}] ${voice} · ${text} · ${(pcm.samples.length/pcm.sampleRate).toFixed(1)}초`);
  }catch(e){
    if(e.status===429){ console.error(`한도에 걸렸어요(${done}개 만듦). 나중에 다시 돌리면 이어서 만들어요.`); process.exit(2); }
    console.error(`${voice} · ${text}: ${e.message}`); process.exit(1);
  }
}
console.log(`끝났어요. ${done}개 만듦`);
