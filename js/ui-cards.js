/* ----- 카드 UI: 대상 목록(store.targets)에서 만들고, 입력 칸은 KINDS[kind].cardFields로 만든다 ----- */
const setText=(el,txt)=>{ if(el.textContent!==txt) el.textContent=txt; };   // 같은 값이면 DOM을 건드리지 않는다
function fieldHtml(f,id){
  const num=f.type==='number', fid=`${id}-${f.key}`;
  return `<label for="${fid}">${f.label}</label><span><input id="${fid}" type="${num?'number':'text'}" data-f="${f.key}"${num?` min="${f.min}" max="${f.max}"`:''}${f.placeholder?` placeholder="${f.placeholder}"`:''}${f.suffix?` aria-describedby="${fid}-sfx"`:''}>`
    +`${f.suffix?` <span class="sub" id="${fid}-sfx">${f.suffix}</span>`:''}${f.hint?` <span class="sub">${f.hint}</span>`:''}</span>`;
}
function initCards(){
  buildCards();
  $('#btnAdd').onclick=()=>{ if($('#addMenu').hidden){ renderAddMenu(); $('#addMenu').hidden=false; $('#btnAdd').setAttribute('aria-expanded','true'); const b=$('#addMenu button:not(:disabled)'); if(b) b.focus(); } else closeAddMenu(); };
  document.addEventListener('click',e=>{ if(!$('#addMenu').hidden&&!e.target.closest('#addBar')) closeAddMenu(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('#addMenu').hidden){ closeAddMenu(); $('#btnAdd').focus(); } });
}
function buildCards(){
  const box=$('#cardList'); box.innerHTML='';
  for(const t of store.targets) box.appendChild(buildCard(t));
  for(const t of store.targets) renderCard(t);
  $('#subtitle').textContent=`감지 대상 ${store.targets.length}개`;
  updateAddBar();
}
function buildCard(t){
  const k=KINDS[t.kind], el=document.createElement('div'), id='t-'+t.id; el.className='card'; el.id='card-'+t.id;
  if(!k){   // 이 버전이 모르는 종류(미래 버전 데이터)는 지우지 않고 안내만
    el.innerHTML='<div class="top"><h2><span data-s="name"></span></h2></div><div class="sub">이 버전에서 지원하지 않는 종류예요</div><div class="row manage" style="margin-top:10px"><button data-a="delete">삭제</button></div>';
    el.querySelector('[data-s=name]').textContent=t.name; el.querySelector('[data-a=delete]').onclick=()=>deleteTarget(t); return el;
  }
  el.innerHTML=`
    <div class="top"><h2><img class="thumb" alt="" hidden><span data-s="name"></span></h2>
      <span class="mini" data-s="mini"></span>
      <label class="sw"><input type="checkbox" data-k="enabled"> 사용</label>
      <button data-a="toggle" aria-expanded="false" aria-controls="body-${t.id}"></button></div>
    <div class="body" id="body-${t.id}">
    <div class="status off" data-s="status">등록 필요</div>
    <div class="sub" data-s="sub"></div>
    <div class="grid">
      ${k.cardFields(t).map(f=>fieldHtml(f,id)).join('')}
      <label for="${id}-thr">기준값</label><span class="row"><input id="${id}-thr" type="range" min="0.4" max="0.98" step="0.01" data-k="threshold" style="flex:1"> <b data-s="thr"></b></span>
      <span>일치도</span><span class="score" data-s="score">–</span>
    </div>
    <div class="row" style="margin-top:10px">
      <button data-a="register">등록</button><button data-a="test">알림 테스트</button>
      ${k.actions.map(a=>`<button data-act="${a.key}">${a.label}</button>`).join('')}
      ${t.preset?'<button data-a="reset">기본 아이콘으로 되돌리기</button>':''}
    </div>
    <div class="row manage" style="margin-top:10px">
      <button data-a="rename">이름 바꾸기</button><button data-a="up">위로</button><button data-a="down">아래로</button><button data-a="delete">삭제</button>
    </div>
    <form class="row" data-s="renameForm" hidden><input maxlength="12" aria-label="새 이름"><button>저장</button><button type="button" data-a="renameCancel">취소</button><span class="sub" role="alert" data-s="renameErr"></span></form>
    </div>`;
  const q=s=>el.querySelector(s);
  q('[data-s=name]').textContent=t.name;
  q('[data-k=enabled]').checked=t.enabled;
  q('[data-k=enabled]').onchange=e=>{ t.enabled=e.target.checked; if(!t.enabled){ states[t.id]=newState(); Alerts.drop(t.id); } saveTargets(); renderWatch(); renderCard(t); };   // 끄는 순간 상태를 새로 시작
  q('[data-k=threshold]').value=t.threshold;
  q('[data-k=threshold]').oninput=e=>{ t.threshold=+e.target.value; saveTargets(); renderCard(t); };
  for(const f of k.cardFields(t)){
    const inp=q(`[data-f=${f.key}]`); inp.value=f.get(t);
    inp.onchange=()=>{ const r=f.set(t,inp.value)||{}; if(r.msg) setNote(r.msg); inp.value=f.get(t); if(!r.revert) saveTargets(); };
  }
  for(const a of k.actions) q(`[data-act=${a.key}]`).onclick=()=>a.run(t,stateOf(t.id),Date.now());
  if(t.preset) q('[data-a=reset]').onclick=()=>{ t.tpl=null; t.area=null; t.frameW=t.frameH=0; saveTargets(); states[t.id]=newState(); renderCard(t); setNote(`${t.name} 기본 아이콘으로 되돌렸어요`,'info'); };
  q('[data-a=register]').onclick=()=>startRegister(t);
  q('[data-a=toggle]').onclick=()=>{ ui.open=ui.open||{}; ui.open[t.id]=!isOpen(t); saveUi(); renderCard(t); };
  const idx=store.targets.indexOf(t), form=q('[data-s=renameForm]'), nameInp=form.querySelector('input');
  q('[data-a=up]').disabled=idx===0; q('[data-a=down]').disabled=idx===store.targets.length-1;
  q('[data-a=up]').setAttribute('aria-label',`${t.name} 위로 옮기기`); q('[data-a=down]').setAttribute('aria-label',`${t.name} 아래로 옮기기`);   // 이름은 HTML 문자열에 넣지 않는다
  q('[data-a=up]').onclick=()=>moveCard(t,-1); q('[data-a=down]').onclick=()=>moveCard(t,1);
  q('[data-a=delete]').onclick=()=>deleteTarget(t);
  q('[data-a=rename]').onclick=()=>{ form.hidden=false; nameInp.value=t.name; nameInp.select(); };
  q('[data-a=renameCancel]').onclick=()=>{ form.hidden=true; q('[data-s=renameErr]').textContent=''; };
  form.onsubmit=e=>{ e.preventDefault(); const r=renameTarget(store,t.id,nameInp.value); if(!r.ok){ q('[data-s=renameErr]').textContent=r.msg; return; } saveTargets(); onTargetsChanged(); };
  q('[data-a=test]').onclick=()=>{ unlockAudio(); testAlert(t); };
  return el;
}
// 종류가 학습 같은 효과로 값을 바꿨을 때(applyEffect) 저장하고 입력 칸을 맞춘다
function onTargetChanged(t,key){
  saveTargets();
  const f=KINDS[t.kind].cardFields(t).find(x=>x.key===key), inp=document.querySelector(`#card-${t.id} [data-f=${key}]`);
  if(f&&inp) inp.value=f.get(t);
}
// 펼침 상태: 사용자가 정한 값(ui.open)이 우선. 정한 적 없으면 등록 필요·다시 등록 필요 대상만 펼친다(알림으로 카드가 움직이지 않게 접은 것은 자동으로 펼치지 않음)
function needsAttention(t){ const k=KINDS[t.kind]; return !!k&&(!k.isRegistered(t)||(!!src&&k.needsReregister(t,frame))); }
function isOpen(t){ return ui.open&&t.id in ui.open ? !!ui.open[t.id] : needsAttention(t); }
function renderCard(t){
  const el=document.getElementById('card-'+t.id), k=KINDS[t.kind]; if(!el||!k) return;
  const st=stateOf(t.id), q=s=>el.querySelector(s);
  const tu=t.tpl?t.tpl.url:(t.preset?PRESETS[t.preset].icons[0].url:''), th=q('.thumb'); th.hidden=!tu; if(tu&&th.getAttribute('src')!==tu) th.src=tu;
  const rb=q('[data-a=reset]'); if(rb) rb.style.display=t.tpl?'':'none';
  setText(q('[data-s=thr]'),t.threshold.toFixed(2));
  const ms=st.ms==null?'':` · 감지 ${st.ms<10?st.ms.toFixed(1):Math.round(st.ms)} ms`;   // 이 대상의 감지에 든 시간(느린 대상을 찾는 용도)
  setText(q('[data-s=score]'),src&&(t.tpl||t.preset)?st.score.toFixed(2)+(st.score>=t.threshold?' ✔':'')+ms:'–');
  const s=cardStatus(t,st,Date.now(),{src:!!src,frame}), sEl=q('[data-s=status]');
  setText(sEl,s.text); const cls='status '+s.cls; if(sEl.className!==cls) sEl.className=cls; setText(q('[data-s=sub]'),s.sub);
  const mini=q('[data-s=mini]'); setText(mini,s.text); const mc='mini '+s.cls; if(mini.className!==mc) mini.className=mc;   // 접힌 카드의 한 줄 상태
  const open=isOpen(t), tg=q('[data-a=toggle]'); if(el.dataset.open!==(open?'1':'0')) el.dataset.open=open?'1':'0';
  setText(tg,open?'접기 ▴':'펼치기 ▾'); tg.setAttribute('aria-expanded',open?'true':'false'); tg.setAttribute('aria-label',`${t.name} ${open?'접기':'펼치기'}`);
}

/* ----- 대상 추가·제거 (순수 부분은 targets.js의 addBuiltin·addBuff) ----- */
const BUFF_NAMES=['유니온의 힘','유니온의 부','재물 획득의 비약','경험치 쿠폰'];   // 이름만 채워 주는 후보. 지속시간 등은 채우지 않는다
function updateAddBar(){ const full=store.targets.length>=TARGET_MAX; $('#btnAdd').disabled=full; setText($('#addNote'),full?FULL_MSG:''); if(full) closeAddMenu(); }
function closeAddMenu(){ $('#addMenu').hidden=true; $('#btnAdd').setAttribute('aria-expanded','false'); }
function menuBtn(text,fn){ const b=document.createElement('button'); b.type='button'; b.textContent=text; b.onclick=fn; return b; }
function renderAddMenu(){
  const m=$('#addMenu'); m.textContent='';
  const group=title=>{ const d=document.createElement('div'), b=document.createElement('b'), o=document.createElement('div'); b.textContent=title; o.className='opts'; d.append(b,o); m.append(d); return o; };
  const base=group('기본 제공'), miss=missingBuiltins(store.targets);
  if(!miss.length){ const s=document.createElement('span'); s.className='sub'; s.textContent='모두 추가돼 있어요'; base.append(s); }
  for(const id of miss) base.append(menuBtn(BUILTIN[id].name,()=>addFromMenu(()=>addBuiltin(store,id))));
  const buffs=group('버프 직접 등록');
  for(const n of BUFF_NAMES){ const b=menuBtn(n,()=>addFromMenu(()=>addBuff(store,n))); b.disabled=store.targets.some(t=>t.name===n); buffs.append(b); }
  buffs.append(menuBtn('이름 직접 입력…',()=>{ $('#addName').hidden=false; $('#addName input').focus(); }));
  const f=document.createElement('form'); f.id='addName'; f.hidden=true;
  f.innerHTML='<label class="sw">이름 <input maxlength="12" aria-label="새 버프 이름"></label><button>추가</button>';
  f.onsubmit=e=>{ e.preventDefault(); addFromMenu(()=>addBuff(store,f.querySelector('input').value)); };
  m.append(f);
}
// 목록이 바뀐 뒤 화면을 다시 맞춘다: 카드, 소리 설정 목록, 상태줄
function onTargetsChanged(){ buildCards(); rebuildSounds(); renderWatch(); }
function addFromMenu(make){
  const r=make(); if(!r.ok){ setNote(r.msg); return; }
  const t=r.target; ui.open=ui.open||{}; ui.open[t.id]=true; saveUi();   // 새 대상은 펼쳐 둔다(펼침 상태는 Task F3에서 쓴다)
  closeAddMenu(); saveTargets(); onTargetsChanged();
  if(!KINDS[t.kind].isRegistered(t)){
    if(src) startRegister(t,{fresh:true});     // 첫 등록을 취소하면 이 대상은 자동으로 지워진다
    else setNote(`${t.name} 등록 필요 · 게임 화면을 연결한 뒤 등록할 수 있어요`);
  }
}
// 확인·되돌리기 없이 바로 뺀다(첫 등록 취소용). 사용자가 누르는 삭제는 Task F2의 deleteTarget
function removeTargetNow(t){
  const i=store.targets.indexOf(t); if(i<0) return -1;
  if(reg&&reg.t===t){ reg=null; updateBanner(); }
  store.targets.splice(i,1); delete states[t.id]; Alerts.drop(t.id);
  saveTargets(); onTargetsChanged(); return i;
}

function moveCard(t,delta){ if(moveTarget(store,t.id,delta)>=0){ saveTargets(); onTargetsChanged(); } }
/* ----- 삭제: 확인 → 바로 뺌 → 10초 되돌리기. 내 소리 파일은 10초 뒤에 지운다(그 사이 탭이 닫히면 다음 로드의 고아 정리가 지움) ----- */
const UNDO_MS=10000, trash=new Map();   // id → {t, index, sounds:Map(slot→소리), timer}
function deleteTarget(t){
  const keys=ownedSlotKeys([...customSounds.keys()],t.id);
  if(!confirm(deleteConfirmText(t.name,keys.length))) return;
  const sounds=new Map(keys.map(k=>[k,customSounds.get(k)])); keys.forEach(k=>customSounds.delete(k));
  const index=removeTargetNow(t);           // 등록 중이면 취소하고, 목록·소리 설정·상태줄을 다시 그림
  const e={t,index,sounds,timer:setTimeout(()=>finalizeDelete(t.id),UNDO_MS)}; trash.set(t.id,e);
  $('#undoText').textContent=`"${t.name}" 지웠어요 ·`; $('#undoBar').hidden=false; $('#undoBtn').onclick=()=>undoDelete(t.id); $('#undoBtn').focus();
}
function finalizeDelete(id){
  const e=trash.get(id); if(!e) return; trash.delete(id); deleteSoundKeys([...e.sounds.keys()]);
  if(!trash.size) $('#undoBar').hidden=true;
}
function undoDelete(id){
  const e=trash.get(id); if(!e) return;
  if(store.targets.length>=TARGET_MAX){ setNote(FULL_MSG+' · 다른 대상을 지우고 되돌려 주세요'); return; }
  clearTimeout(e.timer); trash.delete(id);
  insertTargetAt(store,e.t,e.index); states[e.t.id]=newState(); e.sounds.forEach((v,k)=>customSounds.set(k,v));
  saveTargets(); onTargetsChanged(); renderSounds();
  if(!trash.size) $('#undoBar').hidden=true;
}
