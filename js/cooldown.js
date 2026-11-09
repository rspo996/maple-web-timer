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
if(typeof module==='object') module.exports={CD_MASKED_MIN,TPL_MIN_LUMA,CD_GAP_MS,CD_UNREAD_MS,CD_MIN_SEC,iconGain,classifyIcon,cdNewState,stepCooldown,calibrateCooldown};
