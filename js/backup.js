/* ===== 설정 백업 (묶음 5): 설정 전체를 JSON 파일 하나로 내보내고 불러온다. 서버로 보내지 않는다.
   위쪽은 순수 함수(node 시험), 아래쪽은 화면과 적용(localStorage 먼저 → IndexedDB 한 트랜잭션 → 새로고침) ===== */
const BACKUP_SCHEMA='maple-web-timer-backup', BACKUP_VERSION=1;
const BACKUP_MAX_BYTES=50*1024*1024;            // 불러올 파일 상한(검토 10)
const BACKUP_SOUND_MAX=5*1024*1024, BACKUP_TPL_MAX=500*1024;
const B64_RE=/^[A-Za-z0-9+/]+={0,2}$/;
// 큰 배열도 호출 스택이 넘치지 않게 32KB씩 나눠 바꾼다
function bytesToBase64(u8){ let s=''; for(let i=0;i<u8.length;i+=0x8000) s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000)); return btoa(s); }
function base64ToBytes(b64){ const s=atob(b64), u=new Uint8Array(s.length); for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i); return u; }
function base64Size(b64){ const pad=b64.endsWith('==')?2:b64.endsWith('=')?1:0; return Math.floor(b64.length*3/4)-pad; }
const pad2=n=>String(n).padStart(2,'0');
function backupFileName(d){ return `maple-web-timer-backup-${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}.json`; }
function isoLocal(d){ const o=-d.getTimezoneOffset(), s=o>=0?'+':'-', a=Math.abs(o);
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}${s}${pad2(Math.floor(a/60))}:${pad2(a%60)}`; }
// parts: {targets: v2 Store, manualTimers: manualExport 결과, ui: {volumePct, voice, pip}, sounds: {slot: {name, dur, mime, base64}}}. null인 것은 넣지 않는다
function buildBackup(parts,now){
  const includes=[], data={};
  for(const k of ['targets','manualTimers','ui','sounds']) if(parts[k]!=null){ includes.push(k); data[k]=parts[k]; }
  return {schema:BACKUP_SCHEMA,version:BACKUP_VERSION,exportedAt:isoLocal(now),includes,data};
}
// 봉투 검사와 버전 이전(지금은 v1뿐이라 항등)
function migrateBackup(obj){
  if(!obj||typeof obj!=='object'||Array.isArray(obj)) return {ok:false,msg:'이 파일은 설정 파일이 아닌 것 같아요'};
  if(obj.schema!==BACKUP_SCHEMA) return {ok:false,msg:'메이플 재획 알리미에서 내보낸 파일이 아니에요'};
  if(!Number.isInteger(obj.version)||obj.version<1) return {ok:false,msg:'이 파일은 설정 파일이 아닌 것 같아요'};
  if(obj.version>BACKUP_VERSION) return {ok:false,msg:'더 새 버전에서 만든 파일이라 불러올 수 없어요'};
  return {ok:true,obj};
}
const validTpl=tp=>!!tp&&typeof tp.url==='string'&&tp.url.startsWith('data:image/png;base64,')&&tp.url.length<=BACKUP_TPL_MAX&&[tp.w,tp.h].every(v=>Number.isInteger(v)&&v>=4&&v<=512);
const backupClamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,Math.round(v)));
/* 그룹별로 검사해 {ok, errors[], warnings[], groups:{targets?, manualTimers?, sounds?, ui?}, counts}. 깨진 항목은 그 항목만 건너뛰고 경고,
   그룹 전체가 깨졌으면 그 그룹을 건너뛴다. 대상은 normalizeStore, 수동 타이머는 manualImport(실행 상태 버림)를 거친다 */
function validateBackup(obj){
  const fail=msg=>({ok:false,errors:[msg],warnings:[],groups:{},counts:{}});
  const m=migrateBackup(obj); if(!m.ok) return fail(m.msg);
  const data=obj.data; if(!data||typeof data!=='object'||Array.isArray(data)) return fail('이 파일에 설정이 들어 있지 않아요');
  const inc=new Set(Array.isArray(obj.includes)?obj.includes:[]), warnings=[], groups={}, counts={};
  if(inc.has('targets')&&data.targets&&typeof data.targets==='object'){
    let raw=data.targets;
    if(raw.ver!==2&&!Array.isArray(raw.targets)) raw=migrateV1(raw);                 // v1 모양이면 먼저 옮긴다
    if(raw&&raw.ver===2&&Array.isArray(raw.targets)){
      const kept=[];
      for(const t of raw.targets){
        if(!t||typeof t!=='object') continue;
        const name=typeof t.name==='string'&&t.name?t.name:String(t.id);
        if(!KINDS[t.kind]){ warnings.push(`${name}: 이 버전에서 지원하지 않는 종류라 건너뛰어요`); continue; }
        const c={...t};
        if(c.tpl!=null&&!validTpl(c.tpl)){ warnings.push(`${name}: 등록한 아이콘이 잘못돼서 다시 등록해야 해요`); Object.assign(c,{tpl:null,area:null,frameW:0,frameH:0}); }
        kept.push(c);
      }
      const st=normalizeStore({...raw,targets:kept}); groups.targets=st; counts.targets=st.targets.length;
    } else warnings.push('감지 대상 설정이 깨져 있어서 건너뛰어요');
  }
  if(inc.has('manualTimers')&&data.manualTimers!=null){
    const r=manualImport(data.manualTimers);
    if(r.ok){ groups.manualTimers=r.store; counts.timers=r.store.timers.length; } else warnings.push('수동 타이머 설정이 깨져 있어서 건너뛰어요');
  }
  if(inc.has('ui')&&data.ui&&typeof data.ui==='object'){                              // 허용 목록만(화면 상태 connectedOnce·open 등은 옮기지 않음)
    const u=data.ui, o={};
    if('volumePct' in u) o.volumePct=clampVolumePct(u.volumePct);
    if(typeof u.voice==='boolean') o.voice=u.voice;
    if(u.pip&&Number.isFinite(+u.pip.w)&&Number.isFinite(+u.pip.h)) o.pip={w:backupClamp(+u.pip.w,160,1200),h:backupClamp(+u.pip.h,60,1200)};
    groups.ui=o;
  }
  if(inc.has('sounds')&&data.sounds&&typeof data.sounds==='object'){
    const ids=new Set(groups.targets?groups.targets.targets.map(t=>t.id):[]), out={};
    for(const [k,v] of Object.entries(data.sounds)){
      const bad=()=>warnings.push(`${k} 소리는 불러올 수 없어서 기본 소리로 둬요`);
      if(!/^[A-Za-z0-9]+\.[A-Za-z0-9]+$/.test(k)||!v||typeof v!=='object'||typeof v.base64!=='string'||!B64_RE.test(v.base64)){ bad(); continue; }
      if(base64Size(v.base64)>BACKUP_SOUND_MAX){ bad(); continue; }
      const dur=+v.dur; if(!(dur>0&&dur<=10)){ bad(); continue; }
      const owner=k.split('.')[0];
      if(!/^(sys|grp|manual)$/.test(owner)&&!ids.has(owner)){ warnings.push(`${k} 소리는 쓰이는 대상이 없어 건너뛰어요`); continue; }   // 고아 정리가 지울 소리
      out[k]={name:typeof v.name==='string'?v.name.slice(0,120):'소리',dur,base64:v.base64};
    }
    groups.sounds=out; counts.sounds=Object.keys(out).length;
  }
  const ok=Object.keys(groups).length>0;
  return {ok,errors:ok?[]:['불러올 수 있는 설정이 없어요'],warnings,groups,counts};
}
if(typeof module==='object') module.exports={bytesToBase64,base64ToBytes,base64Size,backupFileName,buildBackup,migrateBackup,validateBackup};

/* ----- 화면: 내보내기·불러오기·확인 창·적용 ----- */
let pendingImport=null;
function backupNote(text,warn){ const n=$('#backupNote'); n.textContent=text; n.classList.toggle('warn',!!warn); }
function soundsBytes(){ let b=0; for(const c of customSounds.values()) b+=c.data.byteLength; return b; }
const sizeText=b=>b>=1048576?`${(b/1048576).toFixed(1)}MB`:`${Math.max(1,Math.round(b/1024))}KB`;
function refreshExportLabel(){
  const n=customSounds.size;
  setText($('#exportSoundsLabel'),n?`내 소리 파일 포함 (${n}개, 약 ${sizeText(soundsBytes()*4/3)})`:'내 소리 파일 포함 (지금은 없음)');   // base64라 약 4/3배
}
function backupInit(){
  $('#btnExport').onclick=exportBackup;
  $('#btnImport').onclick=()=>{ if(src){ backupNote('감시 중에는 불러올 수 없어요. 감시를 끝낸 뒤 다시 해 주세요',true); return; } $('#fileBackup').click(); };
  $('#fileBackup').onchange=async e=>{ const f=e.target.files[0]; e.target.value=''; if(f) await importBackupFile(f); };
  $('#backupDetails').addEventListener('toggle',refreshExportLabel); refreshExportLabel();
  $('#importExportFirst').onclick=e=>{ e.preventDefault(); exportBackup(); };
  // 버튼 클릭에서 바로 처리한다. dialog의 close 이벤트는 늦게 올 수 있어(다시 연 뒤에 이전 이벤트가 도착하는 것을 확인함) 그 시점에 기대지 않는다
  $('#importOk').onclick=()=>{
    const d=$('#importDialog'), v=pendingImport, f=d.querySelector('form').elements, sel={targets:f.targets.checked,manual:f.manual.checked,ui:f.ui.checked};
    pendingImport=null; d.close('ok'); if(v) applyBackup(v,sel);
  };
  $('#importCancel').onclick=()=>{ pendingImport=null; $('#importDialog').close('cancel'); };
}
async function exportBackup(){
  const withSounds=$('#exportSounds').checked, sounds={}; let failed=0;
  backupNote('저장 파일을 만들고 있어요…');
  if(withSounds) for(const [k,c] of customSounds){
    try{ sounds[k]={name:c.name,dur:c.dur,mime:'audio/wav',base64:bytesToBase64(new Uint8Array(c.data))}; }catch(e){ failed++; }
    await new Promise(r=>setTimeout(r,0));                 // 소리 하나마다 감시 틱에 양보
  }
  const now=new Date();
  const obj=buildBackup({targets:store,manualTimers:typeof manual!=='undefined'?manualExport(manual):null,
    ui:{volumePct:clampVolumePct(ui.volumePct!=null?ui.volumePct:$('#vol').value),voice:ui.voice!==false,...(ui.pip?{pip:ui.pip}:{})},sounds:withSounds?sounds:null},now);
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(obj)],{type:'application/json'})); a.download=backupFileName(now);
  document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),60000);
  backupNote(failed?`소리 ${failed}개를 읽지 못해 빼고 저장했어요`:'설정을 파일로 저장했어요',!!failed);
}
async function importBackupFile(f){
  if(src){ backupNote('감시 중에는 불러올 수 없어요. 감시를 끝낸 뒤 다시 해 주세요',true); return; }
  if(f.size>BACKUP_MAX_BYTES){ backupNote('파일이 너무 커요(50MB 이하만 불러와요)',true); return; }
  let obj; try{ obj=JSON.parse(await f.text()); }catch(e){ backupNote('이 파일은 설정 파일이 아닌 것 같아요',true); return; }
  const v=validateBackup(obj); if(!v.ok){ backupNote(v.errors[0],true); return; }
  for(const [k,s] of Object.entries(v.groups.sounds||{})){   // 실제로 풀어서 10초 이하인지(사용자 조작 없이도 되는 OfflineAudioContext)
    try{ const b=await new OfflineAudioContext(1,1,44100).decodeAudioData(base64ToBytes(s.base64).buffer); if(b.duration>SOUND_MAX_SEC+0.05) throw new Error('long'); s.dur=b.duration; }
    catch(e){ delete v.groups.sounds[k]; v.counts.sounds--; v.warnings.push(`${k} 소리는 불러올 수 없어서 기본 소리로 둬요`); }
  }
  showImportDialog(v);
}
function showImportDialog(v){
  pendingImport=v; const g=v.groups, c=v.counts, d=$('#importDialog'), f=d.querySelector('form').elements;
  const parts=[]; if(g.targets) parts.push(`감지 대상 ${c.targets}개`); if(g.manualTimers) parts.push(`수동 타이머 ${c.timers}개`); if(g.sounds) parts.push(`내 소리 ${c.sounds}개`);
  setText($('#importSummary'),`이 파일에서 ${eulReul(parts.length?parts.join(', '):'음량·화면 설정')} 불러와요. 지금 설정은 이 내용으로 바뀌어요.`);
  const extra=[], running=typeof manual!=='undefined'?manual.timers.filter(t=>t.status==='running').length:0;
  if(g.targets&&!g.sounds&&customSounds.size) extra.push(`지금 내 소리 ${customSounds.size}개가 지워져요`);   // 대상과 소리는 한 묶음(슬롯이 대상 id에 묶임)
  if(g.manualTimers&&running) extra.push(`실행 중인 타이머 ${running}개가 멈춰요`);
  setText($('#importExtra'),extra.join(' · ')); $('#importExtra').hidden=!extra.length;
  const sk=$('#importSkipped'); sk.hidden=!v.warnings.length;
  setText(sk.querySelector('summary'),`일부 항목(${v.warnings.length}개)은 건너뛰어요`);
  const ul=sk.querySelector('ul'); ul.textContent=''; for(const w of v.warnings){ const li=document.createElement('li'); li.textContent=w; ul.append(li); }
  for(const [name,has] of [['targets',!!g.targets],['manual',!!g.manualTimers],['ui',!!g.ui]]){ f[name].checked=has; f[name].disabled=!has; }
  d.returnValue=''; d.showModal();
}
// 교체만 한다(병합 없음). localStorage 먼저(이전 값 보관, 실패하면 되돌림) → IndexedDB 소리를 한 트랜잭션으로 → 새로고침. 그동안 저장을 막는다
async function applyBackup(v,sel){
  if(src){ backupNote('감시 중에는 불러올 수 없어요. 감시를 끝낸 뒤 다시 해 주세요',true); return; }
  const keys=[]; if(sel.targets&&v.groups.targets) keys.push(STORE_V2); if(sel.manual&&v.groups.manualTimers) keys.push(MANUAL_STORE); if(sel.ui&&v.groups.ui) keys.push(UI_STORE);
  if(!keys.length) return;
  importing=true;
  const prev={}; for(const k of keys){ try{ prev[k]=localStorage.getItem(k); }catch(e){ prev[k]=null; } }
  const failed=()=>{ for(const k of keys){ try{ if(prev[k]==null) localStorage.removeItem(k); else localStorage.setItem(k,prev[k]); }catch(e){} }
    importing=false; backupNote('설정을 불러오지 못했어요. 지금 설정은 그대로예요',true); };
  try{
    if(keys.includes(STORE_V2)) localStorage.setItem(STORE_V2,JSON.stringify(v.groups.targets));
    if(keys.includes(MANUAL_STORE)) localStorage.setItem(MANUAL_STORE,JSON.stringify(v.groups.manualTimers));
    if(keys.includes(UI_STORE)){ let cur={}; try{ cur=JSON.parse(prev[UI_STORE]||'{}')||{}; }catch(e){} localStorage.setItem(UI_STORE,JSON.stringify({...cur,...v.groups.ui})); }
  }catch(e){ failed(); return; }
  if(keys.includes(STORE_V2)){ try{ await replaceSounds(v.groups.sounds||{}); }catch(e){ failed(); return; } }
  backupNote('설정을 불러왔어요. 화면을 새로 열어요');
  setTimeout(()=>location.reload(),700);
}
function replaceSounds(sounds){
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
