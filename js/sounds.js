/* ----- 알림 소리 바꾸기 (내 WAV 등) ----- */
let SLOTS=[];   // 소리 설정 화면의 행. 대상 목록에서 계산한다(targets.js의 slotsOf)
function refreshSlots(){ SLOTS=slotsOf(store.targets,{manual:typeof manualInit==='function'}); }
// 대상이 추가·삭제·개명·순서 변경될 때 소리 설정 화면을 다시 만든다. 불러 둔 내 소리(customSounds)는 그대로 쓴다
function rebuildSounds(){ refreshSlots(); buildSounds(); }
const SOUND_MAX_SEC=10, SOUND_MAX_BYTES=5*1024*1024;   // 긴 소리는 다음 알림을 밀어내므로 제한
const customSounds=new Map();   // slot → {name, data:ArrayBuffer, dur, buf:AudioBuffer|null}
// 파일은 용량이 커서 localStorage 대신 IndexedDB에 보관
function soundStore(mode){
  return new Promise((resolve,reject)=>{ const r=indexedDB.open('maple-web-timer',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('sounds');
    r.onsuccess=()=>resolve(r.result.transaction('sounds',mode).objectStore('sounds')); r.onerror=()=>reject(r.error); });
}
const idb=q=>new Promise((resolve,reject)=>{ q.onsuccess=()=>resolve(q.result); q.onerror=()=>reject(q.error); });
// 다른 알림 소리 뒤에 이어서 예약해 재생. 내 소리가 없거나 오디오가 아직 꺼져 있으면 false
function playCustom(slot, fallback){
  const c=slot&&customSounds.get(slot); if(!c||!actx) return false;
  const play=buf=>{ const n=actx.createBufferSource(), g=actx.createGain(); n.buffer=buf; g.gain.value=+$('#vol').value;
    n.connect(g).connect(Alerts.audioOut()); const t=Math.max(actx.currentTime+0.02, beepEnd); n.start(t); beepEnd=t+buf.duration+0.06; };
  if(c.buf) play(c.buf);
  else actx.decodeAudioData(c.data.slice(0)).then(b=>{ c.buf=b; play(b); }, ()=>{ if(fallback) fallback(); });
  return true;
}
const slotName=s=>`${s.group} ${s.label}`;
function soundNote(text, warn){ const n=$('#soundNote'); n.textContent=text; n.className='sub'+(warn?' warn':''); }
function previewSlot(s){
  unlockAudio(); if(playCustom(s.key)) return;
  const [id,ev]=s.key.split('.');
  if(id==='sys'){ playDefault(SYS_MSG[ev],'system'); return; }
  if(id==='grp'){ playDefault(groupText(ev,groupPreviewItems(ev)),'multi'); return; }   // 켜진 버프 앞 두 개의 실제 이름으로
  const t=targetById(id), def=t&&KINDS[t.kind]&&KINDS[t.kind].events.find(e=>e.key===ev);
  if(def) playDefault(def.msg(t,{}),def.beep);   // 대상을 못 찾으면 소리 미리듣기만
}
async function pickSound(s, file){
  unlockAudio();
  if(file.size>SOUND_MAX_BYTES){ soundNote(`${slotName(s)}: 5MB 이하 파일만 쓸 수 있어요`,true); return; }
  let data, buf;
  try{ data=await file.arrayBuffer(); buf=await actx.decodeAudioData(data.slice(0)); }
  catch(e){ soundNote(`${slotName(s)}: 이 파일은 재생할 수 없어요. WAV 파일인지 확인해 주세요`,true); return; }
  if(buf.duration>SOUND_MAX_SEC){ soundNote(`${slotName(s)}: ${SOUND_MAX_SEC}초 이하 소리만 쓸 수 있어요 (이 파일은 ${buf.duration.toFixed(1)}초)`,true); return; }
  const rec={name:file.name, data, dur:buf.duration};
  customSounds.set(s.key,{...rec,buf}); renderSounds();
  try{ const st=await soundStore('readwrite'); await idb(st.put(rec,s.key)); soundNote(`${slotName(s)} 소리를 바꿨어요`); }
  catch(e){ soundNote(`${slotName(s)} 소리를 바꿨지만 저장하지 못했어요. 새로고침하면 기본 소리로 돌아가요`,true); }
  playCustom(s.key);
}
async function resetSound(s){
  customSounds.delete(s.key); renderSounds();
  try{ const st=await soundStore('readwrite'); await idb(st.delete(s.key)); }catch(e){}
  soundNote(`${eulReul(slotName(s))} 기본 소리로 되돌렸어요`);
}
function buildSounds(){
  const box=$('#soundRows'); box.textContent=''; let group=null, wrap=null;
  for(const s of SLOTS){
    if(s.group!==group){ group=s.group; wrap=document.createElement('div'); wrap.className='snd-group';
      const h=document.createElement('b'); h.textContent=group; wrap.append(h); box.append(wrap); }
    const row=document.createElement('div'); row.className='snd-row';
    row.innerHTML=`<span>${s.label}</span><span class="snd-file sub"></span>
      <span class="row"><button data-a="pick">파일 고르기</button><button data-a="play">듣기</button><button data-a="reset">기본으로</button></span>
      <input type="file" accept=".wav,audio/*" hidden>`;
    const q=x=>row.querySelector(x), inp=q('input');
    q('[data-a=pick]').setAttribute('aria-label',`${slotName(s)} 소리 파일 고르기`);
    q('[data-a=play]').setAttribute('aria-label',`${slotName(s)} 소리 듣기`);
    q('[data-a=reset]').setAttribute('aria-label',`${slotName(s)} 기본 소리로 되돌리기`);
    q('[data-a=pick]').onclick=()=>{ unlockAudio(); inp.click(); };
    inp.onchange=()=>{ const f=inp.files[0]; inp.value=''; if(f) pickSound(s,f); };
    q('[data-a=play]').onclick=()=>previewSlot(s);
    q('[data-a=reset]').onclick=()=>resetSound(s);
    s.row=row; wrap.append(row);
  }
  renderSounds();
}
function renderSounds(){
  for(const s of SLOTS){ const c=customSounds.get(s.key), f=s.row.querySelector('.snd-file');
    f.textContent=c?`${c.name} · ${c.dur.toFixed(1)}초`:'기본 소리'; f.title=c?c.name:''; f.classList.toggle('custom',!!c);
    const rb=s.row.querySelector('[data-a=reset]'); rb.style.visibility=c?'':'hidden'; rb.disabled=!c; }   // 자리는 남겨 버튼 줄을 맞춤
}
function initSounds(){ refreshSlots(); buildSounds(); loadSounds(); initGroupControl(); }
// 묶음 알림 미리듣기에 쓸 이름: 해당 묶음 종류의 이벤트가 있는 켜진 대상 앞 두 개. 없으면 예시 이름
function groupPreviewItems(cls){
  const names=store.targets.filter(t=>t.enabled&&KINDS[t.kind]&&KINDS[t.kind].events.some(e=>e.group===cls)).slice(0,2).map(t=>t.name);
  return (names.length===2?names:['유니온의 힘','유니온의 부']).map((label,i)=>({label,rank:i,order:i}));
}
// 가까운 알림 묶기 설정: 끔 | 5초 | 10초 | 20초(기본 끔). 바꾸는 즉시 저장하고 Alerts에 알린다
function initGroupControl(){
  const g=store.group, val=g.on?String(g.windowSec):'0';
  for(const r of document.querySelectorAll('#groupCtl input')){
    r.checked=r.value===val;
    r.onchange=()=>{ if(!r.checked) return; const v=+r.value; store.group=v?{on:true,windowSec:v}:{on:false,windowSec:store.group.windowSec}; saveTargets(); Alerts.configure(store.group); };
  }
  Alerts.configure(store.group);
}
async function deleteSoundKeys(keys){
  try{ const st=await soundStore('readwrite'); await Promise.all(keys.map(k=>idb(st.delete(k)))); }catch(e){}
}
async function loadSounds(){
  try{ const st=await soundStore('readonly'); const [ks,vs]=await Promise.all([idb(st.getAllKeys()),idb(st.getAll())]);
    const orphans=new Set(orphanSlots(ks,store.targets,storeStatus));   // 지워진 대상의 소리(탭이 닫혀 10초 삭제를 못 한 것)를 정리
    ks.forEach((k,i)=>{ if(!orphans.has(k)) customSounds.set(k,{...vs[i],buf:null}); });
    if(orphans.size) deleteSoundKeys([...orphans]);
    renderSounds(); predecodeSounds(); }
  catch(e){ soundNote('이 브라우저에서는 내 소리를 저장할 수 없어요. 기본 소리로 알려요',true); }
}
