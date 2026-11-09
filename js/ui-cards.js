/* ----- 카드 UI: 대상 목록(store.targets)에서 만들고, 입력 칸은 KINDS[kind].cardFields로 만든다 ----- */
const setText=(el,txt)=>{ if(el.textContent!==txt) el.textContent=txt; };   // 같은 값이면 DOM을 건드리지 않는다
function fieldHtml(f,id){
  const num=f.type==='number', fid=`${id}-${f.key}`;
  return `<label for="${fid}">${f.label}</label><span><input id="${fid}" type="${num?'number':'text'}" data-f="${f.key}"${num?` min="${f.min}" max="${f.max}"`:''}${f.placeholder?` placeholder="${f.placeholder}"`:''}${f.suffix?` aria-describedby="${fid}-sfx"`:''}>`
    +`${f.suffix?` <span class="sub" id="${fid}-sfx">${f.suffix}</span>`:''}${f.hint?` <span class="sub">${f.hint}</span>`:''}</span>`;
}
function initCards(){ buildCards(); }
function buildCards(){
  const box=$('#cards'); box.innerHTML='';
  for(const t of store.targets) box.appendChild(buildCard(t));
  for(const t of store.targets) renderCard(t);
  $('#subtitle').textContent=`감지 대상 ${store.targets.length}개`;
}
function buildCard(t){
  const k=KINDS[t.kind], el=document.createElement('div'), id='t-'+t.id; el.className='card'; el.id='card-'+t.id;
  if(!k){   // 이 버전이 모르는 종류(미래 버전 데이터)는 지우지 않고 안내만
    el.innerHTML='<div class="top"><h2><span data-s="name"></span></h2></div><div class="sub">이 버전에서 지원하지 않는 종류예요</div>';
    el.querySelector('[data-s=name]').textContent=t.name; return el;
  }
  el.innerHTML=`
    <div class="top"><h2><img class="thumb" alt="" hidden><span data-s="name"></span></h2>
      <label class="sw"><input type="checkbox" data-k="enabled"> 사용</label></div>
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
  q('[data-a=test]').onclick=()=>{ unlockAudio(); testAlert(t); };
  return el;
}
// 종류가 학습 같은 효과로 값을 바꿨을 때(applyEffect) 저장하고 입력 칸을 맞춘다
function onTargetChanged(t,key){
  saveTargets();
  const f=KINDS[t.kind].cardFields(t).find(x=>x.key===key), inp=document.querySelector(`#card-${t.id} [data-f=${key}]`);
  if(f&&inp) inp.value=f.get(t);
}
function renderCard(t){
  const el=document.getElementById('card-'+t.id), k=KINDS[t.kind]; if(!el||!k) return;
  const st=stateOf(t.id), q=s=>el.querySelector(s);
  const tu=t.tpl?t.tpl.url:(t.preset?PRESETS[t.preset].icons[0].url:''), th=q('.thumb'); th.hidden=!tu; if(tu&&th.getAttribute('src')!==tu) th.src=tu;
  const rb=q('[data-a=reset]'); if(rb) rb.style.display=t.tpl?'':'none';
  setText(q('[data-s=thr]'),t.threshold.toFixed(2));
  setText(q('[data-s=score]'),src&&(t.tpl||t.preset)?st.score.toFixed(2)+(st.score>=t.threshold?' ✔':''):'–');
  const s=cardStatus(t,st,Date.now(),{src:!!src,frame}), sEl=q('[data-s=status]');
  setText(sEl,s.text); const cls='status '+s.cls; if(sEl.className!==cls) sEl.className=cls; setText(q('[data-s=sub]'),s.sub);
}
