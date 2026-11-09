/* ----- 감시 상태줄 ----- */
function watchStatus(){
  if(src&&src.type==='stream') return health.badWarned ? {cls:'bad',state:'게임 화면이 안 들어와요',title:'⚠ 화면 안 들어옴'} : {cls:'on',state:'감시 중',title:'● 감시 중'};
  if(src) return {cls:'test',state:'스크린샷 테스트 중 · 실제 감시 아님',title:''};
  if(health.lostAt) return {cls:'bad',state:'연결 끊김 · 알림이 멈췄어요',title:'⚠ 연결 끊김'};
  return {cls:'',state:'연결 안 됨 · 감시하지 않아요',title:''};
}
function baseTitle(){ const t=watchStatus().title; return (t?t+' · ':'')+'메이플 재획 알리미'; }
let watchKey='', noteTimer;
function setNote(text, kind='warn'){
  const n=$('#watchNote'); n.textContent=text; n.className='note'+(kind==='info'?' info':'');
  clearTimeout(noteTimer); if(text&&kind==='info') noteTimer=setTimeout(()=>{ n.textContent=''; },8000);
}
function renderWatch(){
  const w=watchStatus();
  const targets=src ? DEFS.map(d=>({d, s:!cfgs[d.id].enabled?'off':needsRegister(d)?'reg':needsReregister(d)?'rereg'
    :(d.kind!=='rune'&&!states[d.id].seen)?'unseen':'ok'})) : [];
  const key=w.cls+'|'+w.state+'|'+targets.map(t=>t.d.id+':'+t.s).join(',')+'|'+(src&&src.type);
  if(key!==watchKey){   // 바뀔 때만 다시 그려서 화면 낭독기가 매 틱 읽지 않게 함
    watchKey=key; $('#watch').className='watch '+w.cls; $('#watchState').textContent=w.state;
    const box=$('#watchTargets'); box.textContent='';
    targets.forEach(({d,s},i)=>{
      if(i){ const sep=document.createElement('span'); sep.className='sep'; sep.setAttribute('aria-hidden','true'); sep.textContent='·'; box.append(sep); }
      // 연결 뒤 다음에 할 일(등록)이 주된 버튼이 되도록 primary로 강조
      if(s==='reg'||s==='rereg'){ const b=document.createElement('button'); b.className='primary'; b.textContent=`${d.name} ${s==='reg'?'등록하기':'다시 등록'}`; b.onclick=()=>startRegister(d); box.append(b); }
      else { const sp=document.createElement('span'); if(s!=='ok') sp.className=s; sp.textContent=s==='off'?`${d.name} 꺼둠`:s==='unseen'?`${d.name} 아직 못 찾음`:d.name; box.append(sp); }
    });
    const stop=$('#btnStop'); stop.hidden=!src; stop.textContent=src&&src.type==='image'?'테스트 끝내기':'감시 끝내기';
  }
  if(titleTimer===null){ const bt=baseTitle(); if(document.title!==bt) document.title=bt; }
  const stale=src&&src.type==='stream' ? (Date.now()-health.okAt)/1000 : 0;   // 2초 넘게 확인이 없을 때만 경과 시간 표시
  const beat=stale>2 ? `마지막 확인 ${Math.floor(stale)}초 전` : '';
  if($('#watchBeat').textContent!==beat) $('#watchBeat').textContent=beat;
}
function pulse(){ const dot=$('#watchDot'); dot.classList.remove('beat'); void dot.offsetWidth; dot.classList.add('beat'); }
