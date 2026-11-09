/* ----- 카드 UI ----- */
function buildCards(){
  const box=$('#cards'); box.innerHTML='';
  for(const d of DEFS){
    const c=cfgs[d.id], el=document.createElement('div'), id='t-'+d.id; el.className='card'; el.id='card-'+d.id;
    const lead=`<label for="${id}-lead">미리 알림</label><span><input id="${id}-lead" type="number" min="1" max="120" data-k="leadSec"> 초 전</span>`;
    el.innerHTML=`
      <div class="top"><h2><img class="thumb" alt="" hidden>${d.name}</h2>
        <label class="sw"><input type="checkbox" data-k="enabled"> 사용</label></div>
      <div class="status off" data-s="status">등록 필요</div>
      <div class="sub" data-s="sub"></div>
      <div class="grid">
        ${d.kind==='countdown'
          ? lead
          : d.kind==='buff'
          ? `<label for="${id}-dur">지속시간</label><span><input id="${id}-dur" type="text" data-k="duration" placeholder="자동 학습" aria-describedby="${id}-durfmt"> <span class="sub" id="${id}-durfmt">분:초</span></span>
             ${lead}`
          : `<label for="${id}-rep">반복 알림</label><span><input id="${id}-rep" type="number" min="0" max="600" data-k="repeatSec"> 초마다 <span class="sub">(0=끔)</span></span>`}
        <label for="${id}-thr">기준값</label><span class="row"><input id="${id}-thr" type="range" min="0.4" max="0.98" step="0.01" data-k="threshold" style="flex:1"> <b data-s="thr"></b></span>
        <span>일치도</span><span class="score" data-s="score">–</span>
      </div>
      <div class="row" style="margin-top:10px">
        <button data-a="register">등록</button><button data-a="test">알림 테스트</button>
        ${d.kind==='buff'?'<button data-a="restart">방금 켰어요</button>':''}
        ${d.presets?'<button data-a="reset">기본 아이콘으로 되돌리기</button>':''}
      </div>`;
    box.appendChild(el);
    const q=s=>el.querySelector(s);
    q('[data-k=enabled]').checked=c.enabled;
    q('[data-k=enabled]').onchange=e=>{c.enabled=e.target.checked;save();};
    q('[data-k=threshold]').value=c.threshold;
    q('[data-k=threshold]').oninput=e=>{c.threshold=+e.target.value;save();renderCard(d);};
    if(d.kind==='buff'){
      const di=q('[data-k=duration]'); di.value=c.durationSec?fmt(c.durationSec):'';
      di.onchange=()=>{ const v=parseDur(di.value); if(v===undefined){di.value=c.durationSec?fmt(c.durationSec):'';return;} c.durationSec=v; save(); };
      q('[data-a=restart]').onclick=()=>{ const st=states[d.id]; st.appearedAt=Date.now(); st.alertedPre=false; st.present=true; st.seen=true; st.onStreak=2; st.offStreak=0; st.armed=true; };
    }
    if(d.kind!=='rune'){
      q('[data-k=leadSec]').value=c.leadSec;
      q('[data-k=leadSec]').onchange=e=>{ c.leadSec=clampInt(e.target.value,1,120,10); e.target.value=c.leadSec; save(); };
    } else {
      q('[data-k=repeatSec]').value=c.repeatSec;
      q('[data-k=repeatSec]').onchange=e=>{ c.repeatSec=clampInt(e.target.value,0,600,0); e.target.value=c.repeatSec; save(); };
    }
    if(d.presets) q('[data-a=reset]').onclick=()=>{ c.tpl=null; c.area=null; c.frameW=c.frameH=0; save(); states[d.id]=newState(); renderCard(d); setNote(`${d.name} 기본 아이콘으로 되돌렸어요`,'info'); };
    q('[data-a=register]').onclick=()=>startRegister(d);
    q('[data-a=test]').onclick=()=>{ unlockAudio(); fire(d, d.kind==='rune'?'appear':'pre'); };
    renderCard(d);
  }
}
function renderCard(d){
  const el=$('#card-'+d.id); if(!el) return;
  const c=cfgs[d.id], st=states[d.id], q=s=>el.querySelector(s);
  const tu=c.tpl?c.tpl.url:(d.presets?d.presets[0].url:''), th=q('.thumb'); th.hidden=!tu; if(tu&&th.getAttribute('src')!==tu) th.src=tu;
  const rb=q('[data-a=reset]'); if(rb) rb.style.display=c.tpl?'':'none';
  q('[data-s=thr]').textContent=c.threshold.toFixed(2);
  q('[data-s=score]').textContent=src&&(c.tpl||d.presets)?st.score.toFixed(2)+(st.score>=c.threshold?' ✔':''):'–';
  const s=q('[data-s=status]'), sub=q('[data-s=sub]');
  let text, cls='off', subt='';
  if(needsRegister(d)){ text='등록 필요'; subt=`${d.areaLabel} → ${d.iconLabel} 순서로 드래그`; }
  else if(!src){ text='대기 중'; subt='게임 화면을 연결하세요'; }
  else if(needsReregister(d)){ text='다시 등록 필요'; cls='alert'; subt=`등록 당시 화면 ${c.frameW}×${c.frameH}, 지금 ${frame.w}×${frame.h}`; }
  else if(d.kind==='rune'){ text=st.present?'룬 있음!':'룬 없음'; cls=st.present?'alert':'off'; }
  // 꺼져 있는 것과 아이콘을 못 찾는 것을 구분: 이번 연결에서 한 번도 못 봤으면 따로 표시
  else if(!st.present && !st.seen){ text='아직 못 찾음'; subt='이번 연결에서 아직 한 번도 못 봤어요 · 켜져 있는데도 이러면 “등록”으로 직접 지정'; }
  else if(!st.present){ text='꺼져 있음'; }
  else if(d.kind==='countdown'){
    const stuck=`숫자를 ${UNREAD_MS/1000}초 넘게 못 읽었어요`;
    if(st.remain==null){ text=st.ocrWarned?'켜짐 · 숫자를 못 읽음':'켜짐 · 숫자 읽는 중'; cls=st.ocrWarned?'alert':'on'; subt=st.ocrWarned?stuck+' · 안 되면 “등록”으로 “◷ 남은시간” 글자를 직접 지정':st.lastText?'읽은 값 '+st.lastText:'타이머 숫자를 아직 못 읽었어요'; }
    else { const rem=st.remain-(Date.now()-st.remainAt)/1000; text='남은 시간 '+fmt(rem); cls=rem<=c.leadSec?'alert':'on'; subt=st.ocrWarned?stuck+' · 이 시간은 추정이에요':'읽은 값 '+st.lastText+'초'; } }
  else if(!st.appearedAt){ text='켜짐'; cls='on'; subt='켜진 시점을 몰라요 · 다음 사용부터 계산 (또는 “방금 켰어요”)'; }
  else if(!c.durationSec){ text='켜짐 · 학습 중'; cls='on'; subt=`${fmt((Date.now()-st.appearedAt)/1000)} 경과 · 꺼지면 지속시간을 기억합니다`; }
  else { const rem=(st.appearedAt+c.durationSec*1000-Date.now())/1000; text='남은 시간 '+fmt(rem); cls=rem<=c.leadSec?'alert':'on'; }
  if(usingPreset(d.id) && src && !subt) subt=d.kind==='countdown'?'화면 위쪽 가운데의 “남은시간” 타이머를 자동 검색 중':'기본 아이콘으로 화면 오른쪽 위를 자동 검색 중 · 잘 안 잡히면 “등록”으로 직접 지정';
  s.textContent=text; s.className='status '+cls; sub.textContent=subt;
}
