/* ===== 설치기 쿨타임 알림 (묶음 4): 퀵슬롯 아이콘이 어두워지면 쓴 것, 다시 밝아지면 쿨타임 끝.
   NCC(matchTemplate)는 밝기가 고르게 바뀌어도 점수가 그대로라 어두움은 밝기 비로 따로 잰다(스펙 4절).
   위쪽은 순수 함수(node 시험), 아래쪽은 KINDS.cooldown 종류 정의 ===== */
const TPL_MIN_LUMA=40;        // 템플릿에서 이보다 어두운 픽셀은 밝기 비 계산에서 뺀다 [추정]
const CD_GAP_MS=10000;        // 안 보이던 구간이 이보다 길었으면 밝아져도 "지금 막 쓸 수 있다"고 말하지 않는다 [추정]
const CD_UNREAD_MS=90000;     // 아이콘이 이만큼 안 보이면 한 번 알린다(퀵슬롯 페이지 전환 고려) [추정]
const CD_MIN_SEC=3;           // 이보다 짧은 어두움은 쿨타임으로 치지 않는다(MP 부족 등) [추정]
const CD_MASKED_MIN=0.85;     // 숫자 획을 뺀 구조 일치도가 이 이상이면 어두워진 같은 아이콘으로 본다 [추정]

/* 템플릿 대비 현재 밝기 비의 하위 20%(p20)와 중앙값(p50). 템플릿이 어두운 픽셀은 뺀다.
   nccMasked: 템플릿보다 밝아진 픽셀(어두운 아이콘 위에 얹힌 쿨타임 숫자 획)을 빼고 잰 상관계수.
   어두운 아이콘은 명암 차이가 작아 흰 숫자 몇 획만 얹혀도 일반 NCC가 0.3대로 떨어진다(합성 측정) */
function iconGain(tpl,cur,minLuma){
  const r=[]; let n=0,sx=0,sy=0,sxx=0,syy=0,sxy=0;
  for(let i=0;i<tpl.length&&i<cur.length;i++){
    const a=tpl[i], b=cur[i]; if(a<minLuma) continue;
    r.push(b/a);
    if(b<=a*1.05){ n++; sx+=a; sy+=b; sxx+=a*a; syy+=b*b; sxy+=a*b; }
  }
  if(!r.length) return {p20:0,p50:0,n:0,nccMasked:0};
  r.sort((a,b)=>a-b);
  const vx=sxx-sx*sx/n, vy=syy-sy*sy/n, nccMasked=n>=r.length*0.5&&vx>1e-6&&vy>1e-6?(sxy-sx*sy/n)/Math.sqrt(vx*vy):0;
  return {p20:r[Math.floor((r.length-1)*0.2)],p50:r[Math.floor((r.length-1)*0.5)],n:r.length,nccMasked};
}
// ready: 구조가 맞고 아이콘 전체가 밝음(p20). dim: 구조가 맞고(일반 NCC 또는 숫자를 뺀 NCC) 절반 넘게 어두움(p50). 그 밖(가려짐·다른 아이콘)은 unknown
function classifyIcon(ncc,g,cfg){
  if(ncc>=cfg.threshold&&g.p20>=cfg.gainHi) return 'ready';
  if(g.p50<=cfg.gainLo&&(ncc>=cfg.nccDim||(g.nccMasked||0)>=CD_MASKED_MIN)) return 'dim';
  return 'unknown';
}
function cdNewState(){
  return {cur:'init',pending:null,pendCount:0,pendAt:0,usedAt:null,alertedPre:false,preSkipped:false,seen:false,
    unknownSince:null,unreadWarned:false,gapBefore:0,lastCdSec:null};
}
/* 한 틱. obs='ready'|'dim'|'unknown'|null. cfg={durationSec, leadSec}.
   돌려주는 것: 'pre' | {ready:{silent}} | 'unread'. silent: 그 주기에 미리 알림을 울렸음(정책: 미리 알림 뒤 꺼짐류 알림 없음) */
function stepCooldown(S,cfg,obs,now){
  const ev=[];
  if(obs==='unknown'){
    if(S.unknownSince==null) S.unknownSince=now;
    if(S.seen&&!S.unreadWarned&&now-S.unknownSince>=CD_UNREAD_MS){ S.unreadWarned=true; ev.push('unread'); }
  } else if(obs==='ready'||obs==='dim'){
    if(S.unknownSince!=null){ S.gapBefore=now-S.unknownSince; S.unknownSince=null; S.unreadWarned=false; }
    S.seen=true;
    if(obs===S.cur){ S.pending=null; S.pendCount=0; S.gapBefore=0; }
    else {
      if(S.pending===obs) S.pendCount++; else { S.pending=obs; S.pendCount=1; S.pendAt=now; }   // 사이에 낀 unknown은 세지도 지우지도 않는다
      if(S.pendCount>=2){
        const from=S.cur, gap=S.gapBefore; S.cur=obs; S.pending=null; S.pendCount=0; S.gapBefore=0;
        if(obs==='dim'&&from==='ready'){ S.usedAt=S.pendAt; S.alertedPre=false; S.preSkipped=false; }   // 새로 씀: 이전 주기의 pre는 취소
        else if(obs==='dim') S.usedAt=null;                                                           // 연결 때 이미 어두움: 쓴 시각 모름
        else if(from==='dim'){
          const cd=S.usedAt!=null?(now-S.usedAt)/1000:null;
          if(cd!=null&&cd<CD_MIN_SEC){ S.usedAt=null; S.alertedPre=false; }                         // 짧은 어두움은 주기로 치지 않음
          else { S.lastCdSec=cd!=null?Math.floor(cd):null; if(gap<=CD_GAP_MS) ev.push({ready:{silent:S.alertedPre}}); }   // 오래 안 보였으면 조용히 맞춤
        }
      }
    }
  }
  // 시각 기반 미리 알림: 쓴 시각+지속시간-미리 알림. unknown 중에도 울린다. 끝 시각이 이미 지났으면 늦은 "곧"은 틀린 말이라 건너뛴다
  if(S.usedAt!=null&&cfg.durationSec&&!S.alertedPre&&!S.preSkipped){
    const end=S.usedAt+cfg.durationSec*1000, preAt=end-cfg.leadSec*1000;
    if(now>=preAt){ if(now>end) S.preSkipped=true; else { S.alertedPre=true; ev.push('pre'); } }
  }
  return ev;
}
const round3=x=>Math.round(x*1000)/1000;
// "쿨타임 중 찍기": 연속 3프레임의 {ncc, p50}로 어둠 기준을 정한다(스펙 15-4, 3.3)
function calibrateCooldown(samples,threshold){
  const minNcc=Math.min(...samples.map(s=>s.ncc)), maxG=Math.max(...samples.map(s=>s.p50));
  if(minNcc<0.4) return {ok:false,msg:'아이콘을 못 찾았어요'};
  const g=maxG.toFixed(2);
  if(maxG>=0.85) return {ok:false,msg:`쿨타임 때 밝기 차이가 작아요(${g}). 이 아이콘은 구분하기 어려워요. 쿨타임 중에 다시 찍어 주세요`};
  const gainLo=round3(Math.min(0.65,maxG*1.3)), nccDim=round3(Math.min(threshold-0.1,Math.max(0.4,minNcc*0.8)));
  const msg=maxG>=0.8?`쿨타임 때 밝기 차이가 작아요(${g}). 이 아이콘은 구분하기 어려워요. 알림이 틀릴 수 있어요`:`쿨타임 때 밝기가 ${g}로 내려가요. 구분할 수 있어요`;
  return {ok:true,gainLo,nccDim,msg};
}

/* ----- 종류 정의: KINDS.cooldown (kinds.js 뒤에 올라온다. node 시험에서 registerKind가 없으면 건너뜀) ----- */
const cdS=st=>st.cd||(st.cd=cdNewState());
const cdCfg=t=>({threshold:t.threshold,gainHi:t.p.gainHi,gainLo:t.p.gainLo,nccDim:t.p.nccDim});
const cdClamp=(v,lo,hi,d)=>{ const n=+v; return Number.isFinite(n)?Math.min(hi,Math.max(lo,n)):d; };
// 검색 영역: 아이콘 사각형을 사방 8px 넓히고 프레임 안으로 자른다(스펙 15-7)
function cdArea(r,W,H){ const x0=Math.max(0,r.x-8), y0=Math.max(0,r.y-8), x1=Math.min(W,r.x+r.w+8), y1=Math.min(H,r.y+r.h+8); return {x:x0,y:y0,w:x1-x0,h:y1-y0}; }
// 아이콘 자리를 소영역에서 찾고(NCC) 그 자리의 밝기 비를 잰다. 템플릿이 아직 안 읽혔으면 null
function cdMeasure(t,source){
  const tp=loadTpl(t.tpl); if(!tp||!tp.gray) return null;
  const a=t.area, W=Math.max(tp.w,Math.round(a.w*tp.k)), H=Math.max(tp.h,Math.round(a.h*tp.k));
  work.width=W; work.height=H; wctx.drawImage(source,a.x,a.y,a.w,a.h,0,0,W,H);
  const g=toGray(wctx.getImageData(0,0,W,H).data,W*H), r=matchTemplate(g,W,H,tp);
  const win=new Float32Array(tp.w*tp.h);
  for(let y=0;y<tp.h;y++) for(let x=0;x<tp.w;x++) win[y*tp.w+x]=g[(r.y+y)*W+r.x+x];
  const gain=iconGain(tp.gray,win,TPL_MIN_LUMA);
  return {ncc:r.score,score:r.score,gain,state:classifyIcon(r.score,gain,cdCfg(t)),pos:{x:a.x+r.x/tp.k,y:a.y+r.y/tp.k,w:t.tpl.w,h:t.tpl.h}};
}
const cdDurationField={key:'durationSec',label:'지속시간',type:'text',placeholder:'비우면 사라짐 알림 없음',suffix:'분:초',
  get:t=>t.p.durationSec?fmt(t.p.durationSec):'',
  set:(t,raw)=>{ const v=parseDur(raw); if(v===undefined) return {revert:true}; const m=checkDurLead(v,t.p.leadSec,'duration'); if(m) return {revert:true,msg:m}; t.p.durationSec=v||null; return {}; }};
if(typeof registerKind==='function') registerKind('cooldown',{
  label:'설치기', menuLabel:'설치기 쿨타임', defaultName:'설치기', numbered:true, defaultThreshold:0.7, trackSeen:true,
  defaults:()=>({gainHi:0.85,gainLo:0.65,nccDim:0.45,calibrated:false,durationSec:null,leadSec:10}),
  normalizeP:p=>{
    const lead=clampInt(p.leadSec,1,120,10), d=p.durationSec;
    return {...p,gainHi:cdClamp(p.gainHi,0.5,1,0.85),gainLo:cdClamp(p.gainLo,0.05,0.95,0.65),nccDim:cdClamp(p.nccDim,0.2,0.95,0.45),calibrated:p.calibrated===true,
      leadSec:lead,durationSec:typeof d==='number'&&Number.isFinite(d)&&d>lead?Math.round(d):null};
  },
  fixTarget(o){
    if(!(o.p.gainHi>o.p.gainLo)){ o.p.gainHi=0.85; o.p.gainLo=0.65; }
    if(!(o.p.nccDim<o.threshold)) o.p.nccDim=Math.max(0.2,Math.round((o.threshold-0.1)*100)/100);
  },
  labels:()=>({area:'퀵슬롯',icon:'스킬 아이콘'}),
  register:{
    steps:['icon'],
    stepText:{icon:()=>'퀵슬롯에서 쿨타임 없이 밝게 보이는 스킬 아이콘 하나만 꼭 맞게 드래그하세요'},
    validate(t,rects,snap){
      const r=rects.icon;
      if(r.x<0||r.y<0||r.x+r.w>snap.width||r.y+r.h>snap.height) return '아이콘을 화면 안에서 드래그해 주세요';
      if(r.w<8||r.h<8) return '아이콘이 너무 작아요';
      const px=snap.getContext('2d').getImageData(r.x,r.y,r.w,r.h).data, g=toGray(px,r.w*r.h); let m=0; for(const v of g) m+=v; m/=g.length;
      if(m<60) return '아이콘이 어두워 보여요. 쿨타임이 아닐 때 다시 등록해 주세요';   // 어두운 상태로 등록하면 밝기 비가 거꾸로 된다(15-8) [추정: 60]
      return null;
    },
    save(t,rects,snap){
      const r=rects.icon, cv=document.createElement('canvas'); cv.width=r.w; cv.height=r.h;
      cv.getContext('2d').drawImage(snap,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
      Object.assign(t,{tpl:{url:cv.toDataURL('image/png'),w:r.w,h:r.h},area:cdArea(r,snap.width,snap.height),frameW:snap.width,frameH:snap.height});
      t.p.calibrated=false; t.p.gainLo=0.65; t.p.nccDim=Math.min(0.45,Math.round((t.threshold-0.1)*100)/100);
    },
    doneNote:t=>`${t.name} 등록했어요 · 스킬을 쓰고 쿨타임 중에 “쿨타임 중 찍기”를 누르면 더 정확해져요`,
  },
  events:[
    {key:'pre',label:'곧 사라짐',beep:'buff',group:'pre',msg:t=>`${t.name} ${t.p.leadSec}초 뒤 사라져요`},
    {key:'ready',label:'다시 쓸 수 있음',beep:'ready',group:null,msg:t=>`${t.name} 다시 쓸 수 있어요`},
    {key:'unread',label:'아이콘 안 보임',beep:'system',group:null,msg:t=>`${t.name} 아이콘이 안 보여요`},
  ],
  detect:(t,source)=>t.tpl&&t.area?cdMeasure(t,source):null,
  step(t,st,det,source,now,ctx){
    const S=cdS(st); st.cdLast=det;
    if(S.calib){                                          // 쿨타임 중 찍기: 연속 3프레임
      S.calib.samples.push({ncc:Math.max(det.ncc,det.gain.nccMasked||0),p50:det.gain.p50});   // 숫자 획 때문에 일반 NCC가 낮을 수 있다
      if(S.calib.samples.length>=3){
        const r=calibrateCooldown(S.calib.samples,t.threshold); S.calib=null;
        if(r.ok){ t.p.gainLo=r.gainLo; t.p.nccDim=r.nccDim; t.p.calibrated=true; if(typeof onTargetChanged==='function') onTargetChanged(t,'gainLo'); }
        if(typeof setNote==='function') setNote(`${t.name} · ${r.msg}`,r.ok&&!r.msg.includes('어려워요')?'info':'warn');
      }
    }
    if(det.gain.p50>1.3) S.brightSince=S.brightSince||now; else S.brightSince=null;   // 어두운 상태로 등록한 듯
    if(!ctx||!ctx.live) return [];                         // 스크린샷 테스트: 상태·측정값만, 알림 없음
    const evs=stepCooldown(S,{durationSec:t.p.durationSec,leadSec:t.p.leadSec},det.state,now);
    st.seen=S.seen;
    return evs.filter(e=>!(e.ready&&e.ready.silent)).map(e=>e.ready?'ready':e);   // pre를 울린 주기의 ready는 화면만(정책)
  },
  markPre(st){ cdS(st).alertedPre=true; },               // 당겨 알림으로 묶인 주기도 ready 무음
  remainSec(t,st,now){
    const S=st.cd; if(!S||S.usedAt==null||!t.p.durationSec||S.alertedPre||S.cur!=='dim') return null;
    const r=(S.usedAt+t.p.durationSec*1000-now)/1000; return r>0?r:null;
  },
  status(t,st,now,ctx){
    const k=KINDS.cooldown;
    if(!k.isRegistered(t)) return {text:'등록 필요',cls:'off',sub:'퀵슬롯의 스킬 아이콘을 드래그'};
    const c=commonStatus(k,t,ctx); if(c) return c;
    const S=st.cd||cdNewState(), test=ctx.live?'':'스크린샷 테스트에서는 알리지 않아요';
    if(!S.seen) return {text:'아직 못 찾음',cls:'off',sub:test||'이번 연결에서 아직 한 번도 못 봤어요 · 아이콘이 퀵슬롯에 보이는지 확인하세요'};
    if(S.unknownSince!=null) return {text:'아이콘 확인 중',cls:'off',sub:'퀵슬롯 페이지가 바뀌었는지 보세요'};
    const dark=S.brightSince&&now-S.brightSince>10000?'아이콘이 어두워 보여요. 쿨타임이 아닐 때 다시 등록해 주세요':'';
    if(S.cur==='ready') return {text:'쓸 수 있음',cls:'on',sub:dark||test||(t.p.calibrated?'':'쿨타임 기준 미확인 · 스킬을 쓰고 “쿨타임 중 찍기”')};
    if(S.cur==='dim'){
      if(S.usedAt==null) return {text:'쿨타임 중',cls:'on',sub:'시작을 몰라서 사라짐 알림은 다음 사용부터 · “방금 썼어요”로 직접 지정'};
      const el=(now-S.usedAt)/1000, dur=t.p.durationSec;
      const sub=!dur?'지속시간을 적으면 사라지기 전에 알려요':S.alertedPre?'곧 사라져요 알림을 울렸어요':S.preSkipped?'':`사라지기까지 ${fmt(dur-el)}`;
      return {text:`쿨타임 중 · ${fmt(el)} 경과`,cls:dur&&!S.alertedPre&&!S.preSkipped&&dur-el<=t.p.leadSec?'alert':'on',sub:test||sub};
    }
    return {text:'확인 중',cls:'off',sub:test};
  },
  scoreRow(t,st){
    const d=st.cdLast; if(!d) return {label:'일치도·밝기',text:'–'};
    return {label:'일치도·밝기',text:`${d.ncc.toFixed(2)} · 밝기 ${d.gain.p50.toFixed(2)}${t.p.calibrated?'':' · 쿨타임 기준 미확인'}`};
  },
  cardFields:()=>[cdDurationField,leadField],
  actions:[
    {key:'calib',label:'쿨타임 중 찍기',run(t,st){
      if(typeof src!=='undefined'&&!src){ if(typeof setNote==='function') setNote('게임 화면을 연결한 뒤 쿨타임 중에 눌러 주세요'); return; }
      cdS(st).calib={samples:[]}; if(typeof setNote==='function') setNote(`${t.name} 쿨타임 중인 아이콘을 재는 중이에요`,'info'); }},
    {key:'used',label:'방금 썼어요',run(t,st,now){ Object.assign(cdS(st),{cur:'dim',usedAt:now,alertedPre:false,preSkipped:false,pending:null,pendCount:0,seen:true,unknownSince:null}); st.seen=true; }},
  ],
});
if(typeof module==='object') module.exports={CD_MASKED_MIN,TPL_MIN_LUMA,CD_GAP_MS,CD_UNREAD_MS,CD_MIN_SEC,iconGain,classifyIcon,cdNewState,stepCooldown,calibrateCooldown};
