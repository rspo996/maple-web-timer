import {src} from './capture.js';
import {bump} from './bus.js';
import {manual} from './manual.js';
import {UI_STORE,setImporting,ui} from './prefs.js';
import {SOUND_MAX_SEC,customSounds} from './sounds.js';
import {store} from './store.js';
import {BACKUP_MAX_BYTES,backupFileName,base64ToBytes,buildBackup,bytesToBase64,validateBackup} from '../core/backup-core.js';
import {MANUAL_STORE,manualExport} from '../core/manual-core.js';
import {STORE_V2} from '../core/targets.js';
import {clampVolumePct,eulReul} from '../core/util.js';

/* ----- 엔진 쪽: 내보내기·불러오기·확인 창 내용·적용. 화면은 ui/Backup.jsx·ui/ImportDialog.jsx ----- */
export let pendingImport=null;
export const backupMsg={text:'',warn:false};   // 백업 창 아래 안내 한 줄
export const exportOpts={withSounds:true};       // "내 소리 파일 포함" 칸(확인 창의 "먼저 지금 설정 내보내기"도 이 값을 쓴다)
export function backupNote(text,warn){ backupMsg.text=text; backupMsg.warn=!!warn; bump(); }
export function soundsBytes(){ let b=0; for(const c of customSounds.values()) b+=c.data.byteLength; return b; }
export const sizeText=b=>b>=1048576?`${(b/1048576).toFixed(1)}MB`:`${Math.max(1,Math.round(b/1024))}KB`;
// 내보내기의 "내 소리 파일 포함" 칸 문구. base64라 약 4/3배
export function exportSoundsLabel(){
  const n=customSounds.size;
  return n?`내 소리 파일 포함 (${n}개, 약 ${sizeText(soundsBytes()*4/3)})`:'내 소리 파일 포함 (지금은 없음)';
}
const WATCHING_MSG='감시 중에는 불러올 수 없어요. 감시를 끝낸 뒤 다시 해 주세요';
// "설정 불러오기": 감시 중이면 안내하고 false. 아니면 true(화면이 파일 고르기 창을 연다)
export function canImport(){ if(src){ backupNote(WATCHING_MSG,true); return false; } return true; }
export async function exportBackup(withSounds){
  const sounds={}; let failed=0;
  backupNote('저장 파일을 만들고 있어요…');
  if(withSounds) for(const [k,c] of customSounds){
    try{ sounds[k]={name:c.name,dur:c.dur,mime:'audio/wav',base64:bytesToBase64(new Uint8Array(c.data))}; }catch(e){ failed++; }
    await new Promise(r=>setTimeout(r,0));                 // 소리 하나마다 감시 틱에 양보
  }
  const now=new Date();
  const obj=buildBackup({targets:store,manualTimers:manualExport(manual),
    ui:{volumePct:clampVolumePct(ui.volumePct),voice:ui.voice!==false,...(ui.pip?{pip:ui.pip}:{})},sounds:withSounds?sounds:null},now);
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(obj)],{type:'application/json'})); a.download=backupFileName(now);
  document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),60000);
  backupNote(failed?`소리 ${failed}개를 읽지 못해 빼고 저장했어요`:'설정을 파일로 저장했어요',!!failed);
}
export async function importBackupFile(f){
  if(src){ backupNote(WATCHING_MSG,true); return; }
  if(f.size>BACKUP_MAX_BYTES){ backupNote('파일이 너무 커요(50MB 이하만 불러와요)',true); return; }
  let obj; try{ obj=JSON.parse(await f.text()); }catch(e){ backupNote('이 파일은 설정 파일이 아닌 것 같아요',true); return; }
  const v=validateBackup(obj); if(!v.ok){ backupNote(v.errors[0],true); return; }
  for(const [k,s] of Object.entries(v.groups.sounds||{})){   // 실제로 풀어서 10초 이하인지(사용자 조작 없이도 되는 OfflineAudioContext)
    try{ const b=await new OfflineAudioContext(1,1,44100).decodeAudioData(base64ToBytes(s.base64).buffer); if(b.duration>SOUND_MAX_SEC+0.05) throw new Error('long'); s.dur=b.duration; }
    catch(e){ delete v.groups.sounds[k]; v.counts.sounds--; v.warnings.push(`${k} 소리는 불러올 수 없어서 기본 소리로 둬요`); }
  }
  showImportDialog(v);
}
// 확인 창에 보일 내용. seq가 바뀌면 화면이 창을 연다(ui/ImportDialog.jsx)
export const importView={seq:0,open:false,summary:'',extra:'',warnings:[],has:{targets:false,manual:false,ui:false}};
export function showImportDialog(v){
  pendingImport=v; const g=v.groups, c=v.counts;
  const parts=[]; if(g.targets) parts.push(`감지 대상 ${c.targets}개`); if(g.manualTimers) parts.push(`수동 타이머 ${c.timers}개`); if(g.sounds) parts.push(`내 소리 ${c.sounds}개`);
  const extra=[], running=manual.timers.filter(t=>t.status==='running').length;
  if(g.targets&&!g.sounds&&customSounds.size) extra.push(`지금 내 소리 ${customSounds.size}개가 지워져요`);   // 대상과 소리는 한 묶음(슬롯이 대상 id에 묶임)
  if(g.manualTimers&&running) extra.push(`실행 중인 타이머 ${running}개가 멈춰요`);
  Object.assign(importView,{seq:importView.seq+1,open:true,
    summary:`이 파일에서 ${eulReul(parts.length?parts.join(', '):'음량·화면 설정')} 불러와요. 지금 설정은 이 내용으로 바뀌어요.`,
    extra:extra.join(' · '),warnings:[...v.warnings],has:{targets:!!g.targets,manual:!!g.manualTimers,ui:!!g.ui}});
  bump();
}
// 확인 창의 "불러오기"·"취소". dialog의 close 이벤트는 늦게 올 수 있어(다시 연 뒤에 이전 이벤트가 도착하는 것을 확인함) 버튼 클릭에서 바로 처리한다
export function confirmImport(sel){ const v=pendingImport; pendingImport=null; importView.open=false; bump(); if(v) applyBackup(v,sel); }
export function cancelImport(){ pendingImport=null; importView.open=false; bump(); }
// 교체만 한다(병합 없음). localStorage 먼저(이전 값 보관, 실패하면 되돌림) → IndexedDB 소리를 한 트랜잭션으로 → 새로고침. 그동안 저장을 막는다
export async function applyBackup(v,sel){
  if(src){ backupNote('감시 중에는 불러올 수 없어요. 감시를 끝낸 뒤 다시 해 주세요',true); return; }
  const keys=[]; if(sel.targets&&v.groups.targets) keys.push(STORE_V2); if(sel.manual&&v.groups.manualTimers) keys.push(MANUAL_STORE); if(sel.ui&&v.groups.ui) keys.push(UI_STORE);
  if(!keys.length) return;
  setImporting(true);
  const prev={}; for(const k of keys){ try{ prev[k]=localStorage.getItem(k); }catch(e){ prev[k]=null; } }
  const failed=()=>{ for(const k of keys){ try{ if(prev[k]==null) localStorage.removeItem(k); else localStorage.setItem(k,prev[k]); }catch(e){} }
    setImporting(false); backupNote('설정을 불러오지 못했어요. 지금 설정은 그대로예요',true); };
  try{
    if(keys.includes(STORE_V2)) localStorage.setItem(STORE_V2,JSON.stringify(v.groups.targets));
    if(keys.includes(MANUAL_STORE)) localStorage.setItem(MANUAL_STORE,JSON.stringify(v.groups.manualTimers));
    if(keys.includes(UI_STORE)){ let cur={}; try{ cur=JSON.parse(prev[UI_STORE]||'{}')||{}; }catch(e){} localStorage.setItem(UI_STORE,JSON.stringify({...cur,...v.groups.ui})); }
  }catch(e){ failed(); return; }
  if(keys.includes(STORE_V2)){ try{ await replaceSounds(v.groups.sounds||{}); }catch(e){ failed(); return; } }
  backupNote('설정을 불러왔어요. 화면을 새로 열어요');
  setTimeout(()=>location.reload(),700);
}
export function replaceSounds(sounds){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open('maple-web-timer',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('sounds');
    r.onerror=()=>reject(r.error||new Error('open'));
    r.onsuccess=()=>{
      const db=r.result; let tx;
      try{ tx=db.transaction('sounds','readwrite'); }catch(e){ db.close(); reject(e); return; }
      const st=tx.objectStore('sounds'); st.clear();
      for(const [k,s] of Object.entries(sounds)) st.put({name:s.name,data:base64ToBytes(s.base64).buffer,dur:s.dur},k);   // 트랜잭션 안에서는 await 없음
      tx.oncomplete=()=>{ db.close(); resolve(); };
      tx.onerror=tx.onabort=()=>{ db.close(); reject(tx.error||new Error('abort')); };
    };
  });
}
