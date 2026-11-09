const states={}; const tplCache={};
const stateOf=id=>states[id]||(states[id]=newState());
// 모든 대상의 감지 상태를 새로 시작. armed=true는 스크린샷 테스트(처음부터 켜짐 시각을 믿음)
function resetAllStates(armed){ for(const t of store.targets){ states[t.id]=newState(); if(armed) states[t.id].armed=true; } }

/* ----- 감지 ----- */
function scaleFor(tw,th){ return Math.min(1,Math.max(0.25,14/Math.min(tw,th))); }
function loadTpl(t){
  const s=t.s||1, key=t.url+"@"+s; const ca=tplCache[key]; if(ca) return ca.ready?ca:null;
  const ent={ready:false}; tplCache[key]=ent;
  const img=new Image(); img.onload=()=>{
    const m=t.crop||0, iw=img.width-2*m, ih=img.height-2*m;
    const k=scaleFor(iw*s,ih*s), w=Math.max(4,Math.round(iw*s*k)), h=Math.max(4,Math.round(ih*s*k));
    work.width=w; work.height=h; wctx.fillStyle="#000"; wctx.fillRect(0,0,w,h); wctx.drawImage(img,m,m,iw,ih,0,0,w,h);
    Object.assign(ent,{k,m:m*s,ready:true},prepTemplate(toGray(wctx.getImageData(0,0,w,h).data,w*h),w,h));
  }; img.src=t.url; return null;
}
function areaOf(t){
  if(t.area&&t.tpl) return t.area;
  if(isPresetMode(t)&&frame.w) return PRESETS[t.preset].area(frame);   // 내장 아이콘: 솔 야누스는 오른쪽 위, 부스터는 위쪽 가운데
  return null;
}
// 템플릿 매칭으로 대상을 찾는다. buff·countdown·rune이 공용(KINDS.detect의 기본값). 돌려주는 값은 {score, pos} 또는 null
function detectTemplate(t, source){
  const a=areaOf(t); if(!a) return null;
  if(t.tpl && t.frameW && (t.frameW!==frame.w||t.frameH!==frame.h)) return null;
  // 기본 아이콘은 UI 배율이 달라도 찾도록 여러 크기로 검색. 한 번 찾으면 그 크기부터 먼저 확인
  const P=t.preset&&PRESETS[t.preset];
  const cands=t.tpl?[t.tpl]:P.icons.flatMap(p=>P.scales.map(s=>({...p,s})));
  const st=stateOf(t.id), hit=st.hit&&cands.find(x=>x.url===st.hit.url&&x.s===st.hit.s);
  const order=hit?[hit,...cands.filter(x=>x!==hit)]:cands;
  let best=null;
  for(const c of order){
    const tp=loadTpl(c); if(!tp) continue;
    if(best&&best.score>=t.threshold&&c!==order[0]) break;
    const W=Math.round(a.w*tp.k), H=Math.round(a.h*tp.k);
    work.width=W; work.height=H; wctx.drawImage(source,a.x,a.y,a.w,a.h,0,0,W,H);
    const r=matchTemplate(toGray(wctx.getImageData(0,0,W,H).data,W*H),W,H,tp);
    if(!best||r.score>best.score) best={score:r.score,t:c,pos:{x:a.x+r.x/tp.k-tp.m,y:a.y+r.y/tp.k-tp.m,w:c.w*(c.s||1),h:c.h*(c.s||1)}};
  }
  if(best&&best.score>=t.threshold) st.hit={url:best.t.url,s:best.t.s};
  return best;
}
// “남은시간” 글자 오른쪽의 숫자 영역을 원본 해상도로 잘라 읽기
function readTimer(source, p){
  const x0=Math.round(p.x+p.w*1.05), x1=Math.round(p.x+p.w*2.75), y0=Math.round(p.y), y1=Math.round(p.y+p.h*2.0);
  const W=Math.min(x1,frame.w)-x0, H=Math.min(y1,frame.h)-y0; if(W<10||H<8||x0<0||y0<0) return null;
  work.width=W; work.height=H; wctx.drawImage(source,x0,y0,W,H,0,0,W,H);
  return {rect:{x:x0,y:y0,w:W,h:H}, read:ocrSevenSeg(wctx.getImageData(0,0,W,H).data,W,H)};
}
// 거의 검은 프레임(맵 이동 중 암전, 창 최소화 등)인지. 이때 감지하면 버프가 꺼진 것으로 오판하므로 건너뜀
function isBlank(s){
  const [w,h]=dims(s); if(!w||!h) return true;
  work.width=64; work.height=36; wctx.drawImage(s,0,0,w,h,0,0,64,36);
  const p=wctx.getImageData(0,0,64,36).data;
  for(let i=0;i<p.length;i+=4) if(0.299*p[i]+0.587*p[i+1]+0.114*p[i+2]>=8) return false;
  return true;
}
// 종류의 step이 돌려준 이벤트를 알림 후보로 모은다. events에 선언된 키만 알림이 되고(appear-unknown 같은 내부 이벤트는 버림), effect는 종류가 처리한다
function collectEvents(t,evs,out){
  const k=KINDS[t.kind];
  for(const ev of evs){
    const e=typeof ev==='string'?{key:ev}:ev;
    if(e.effect){ k.applyEffect(t,e); continue; }
    const def=k.events.find(x=>x.key===e.key); if(def) out.push({t,def,info:e.info||{}});
  }
}
function reqFor(t,def,info,rank){
  return {src:'target',id:t.id,event:def.key,text:def.msg(t,info||{}),beep:def.beep,slot:`${t.id}.${def.key}`,mode:'full',flash:'card-'+t.id,
    group:def.group?{cls:def.group,label:t.name,rank:rank==null?(t.p.leadSec||0):rank,order:store.targets.indexOf(t)}:null};
}
function dispatchEvents(list,now){ for(const x of list) Alerts.fire(reqFor(x.t,x.def,x.info)); }
// 카드의 "알림 테스트": 묶지 않고 첫 이벤트를 개별 알림으로 재생
function testAlert(t){ const def=KINDS[t.kind].events[0]; Alerts.fire({...reqFor(t,def,{}),src:'test',group:null}); }
let busy=false;
async function tick(){
  if(busy) return; busy=true;
  try{
    const now=Date.now(), g=await grab(), source=g.frame; frameFresh=g.fresh;
    if(source){ [frame.w,frame.h]=dims(source); }
    const live=!!src&&src.type==='stream', ok=!!source&&!(live&&isBlank(source));
    if(live){
      if(ok){ health.okAt=now; health.badSince=null; if(health.badWarned){ health.badWarned=false; fireSystem('back'); } }
      else { health.badSince=health.badSince||now; if(!health.badWarned && now-health.badSince>=STALL_MS){ health.badWarned=true; fireSystem('stall'); } }
    } else if(!src && health.lostAt && health.reminders<LOST_REMIND_MAX && now-health.remindAt>=LOST_REMIND_MS){
      health.reminders++; health.remindAt=now; fireSystem('lost');
    }
    const evq=[], ctx={src:!!src,frame,fresh:frameFresh};
    for(const t of store.targets){
      const k=KINDS[t.kind]; if(!k) continue;
      const st=stateOf(t.id);
      if(ok && t.enabled && !reg){
        const det=k.detect(t,source,ctx);
        if(det){ st.score=det.score; st.pos=det.pos; collectEvents(t,k.step(t,st,det,source,now,ctx),evq); }
        else if(k.onSkip) collectEvents(t,k.step(t,st,null,source,now,ctx),evq);
      } else if(k.onSkip && t.enabled) collectEvents(t,k.step(t,st,null,null,now,ctx),evq);   // 감지를 건너뛴 틱에도 부르는 종류(묶음 3)
      if(!document.hidden) renderCard(t);
    }
    dispatchEvents(evq,now);
    renderWatch();   // 탭 제목은 숨겨져 있어도 갱신
    if(!document.hidden){ drawPreview(source); if(live&&ok) pulse(); }
  } finally { busy=false; Alerts.flush(Date.now()); }
}
