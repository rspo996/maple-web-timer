import {Alerts} from './alerts.js';
import {batch} from './bus.js';
import {STALL_MS,dims,frame,grab,health,setFrameFresh,src,viewCtx} from './capture.js';
import {pipUpdate} from './pip.js';
import {drawPreview,reg} from './register.js';
import {store,targetById} from './store.js';
import {pulse,renderWatch,setNote} from './watch.js';
import {planGroup} from '../core/alerts-core.js';
import {newState,ocrSevenSeg} from '../core/detect-core.js';
import {KINDS,isPresetMode,sayName} from '../core/kinds.js';
import {bandMask,diamondMask,matchTemplate,prepTemplate,toGray} from '../core/match.js';
import {scratch} from '../core/scratch.js';
import {createSlowWatch} from '../core/slow-watch.js';
import {PRESETS} from '../core/targets.js';
export const states={}; export const tplCache={};
export const stateOf=id=>states[id]||(states[id]=newState());
// 모든 대상의 감지 상태를 새로 시작. armed=true는 스크린샷 테스트(처음부터 켜짐 시각을 믿음)
export function resetAllStates(armed){ for(const t of store.targets){ states[t.id]=newState(); if(armed) states[t.id].armed=true; } }

/* ----- 감지 ----- */
export function scaleFor(tw,th){ return Math.min(1,Math.max(0.25,14/Math.min(tw,th))); }
// band([lo,hi])를 주면 그 가운데 행 띠를 빼고 비교하는 템플릿을 만들고, 축소 검색 뒤 다시 잴 원본 크기 템플릿(full)도 같이 만든다.
// 아이콘의 shape가 'diamond'(내장 룬)면 마름모 안쪽만 비교한다(모서리의 미니맵 배경은 맵마다 다름)
export function loadTpl(t,band){
  const s=t.s||1, key=t.url+"@"+s+(band?"#"+band.join(","):"")+(t.shape?"#"+t.shape:""); const ca=tplCache[key]; if(ca) return ca.ready?ca:null;
  const ent={ready:false}; tplCache[key]=ent;
  const img=new Image(); img.onload=()=>{
    const m=t.crop||0, iw=img.width-2*m, ih=img.height-2*m;
    const draw=(w,h)=>{ const {work,wctx}=scratch(); work.width=w; work.height=h; wctx.fillStyle="#000"; wctx.fillRect(0,0,w,h); wctx.drawImage(img,m,m,iw,ih,0,0,w,h); return toGray(wctx.getImageData(0,0,w,h).data,w*h); };
    const maskOf=(w,h)=>t.shape==='diamond'?diamondMask(w,h):band?bandMask(w,h,band[0],band[1]):undefined;
    const k=scaleFor(iw*s,ih*s), w=Math.max(4,Math.round(iw*s*k)), h=Math.max(4,Math.round(ih*s*k));
    const gray=draw(w,h);   // 원본 회색값도 보관(설치기의 밝기 비, 묶음 4 스펙 15-1)
    let full=null;
    if(band&&k<1){ const fw=Math.max(4,Math.round(iw*s)), fh=Math.max(4,Math.round(ih*s)); full=prepTemplate(draw(fw,fh),fw,fh,maskOf(fw,fh)); }
    Object.assign(ent,{k,m:m*s,ready:true,gray,full},prepTemplate(gray,w,h,maskOf(w,h)));
  }; img.src=t.url; return null;
}
// 축소 검색으로 찾은 위치(x,y: 원본 화면 좌표) 주변 ±R px를 원본 해상도로 다시 잰다. 축소하면 숫자 띠를 뺀 템플릿이 작아져 다른 아이콘과 점수 차가 줄어들기 때문
export function refineAt(source,tp,x,y,R){
  const x0=Math.max(0,Math.round(x)-R), y0=Math.max(0,Math.round(y)-R);
  const W=Math.min(frame.w,Math.round(x)+tp.w+R)-x0, H=Math.min(frame.h,Math.round(y)+tp.h+R)-y0;
  if(W<tp.w||H<tp.h) return null;
  const {work,wctx}=scratch(); work.width=W; work.height=H; wctx.drawImage(source,x0,y0,W,H,0,0,W,H);
  const r=matchTemplate(toGray(wctx.getImageData(0,0,W,H).data,W*H),W,H,tp);
  return {score:r.score,x:x0+r.x,y:y0+r.y};
}
// pos 상자 가운데 3×3의 평균 색이 fill(r,g,b)을 만족하는지
export function fillAt(source,pos,fill){
  const x=Math.round(pos.x+pos.w/2-1.5), y=Math.round(pos.y+pos.h/2-1.5);
  if(x<0||y<0||x+3>frame.w||y+3>frame.h) return false;
  const {work,wctx}=scratch(); work.width=3; work.height=3; wctx.drawImage(source,x,y,3,3,0,0,3,3);
  const d=wctx.getImageData(0,0,3,3).data; let r=0,g=0,b=0; for(let i=0;i<36;i+=4){ r+=d[i]; g+=d[i+1]; b+=d[i+2]; }
  return fill(r/9,g/9,b/9);
}
export function areaOf(t){
  if(t.area&&(t.tpl||(KINDS[t.kind]&&KINDS[t.kind].needsTemplate===false))) return t.area;   // 사냥 멈춤처럼 템플릿 없이 영역만 쓰는 종류
  if(isPresetMode(t)&&frame.w) return PRESETS[t.preset].area(frame);   // 내장 아이콘: 솔 야누스는 오른쪽 위, 부스터는 위쪽 가운데, 룬은 왼쪽 위(미니맵)
  return null;
}
// 템플릿 매칭으로 대상을 찾는다. buff·countdown·rune이 공용(KINDS.detect의 기본값). 돌려주는 값은 {score, pos} 또는 null
export function detectTemplate(t, source){
  const a=areaOf(t); if(!a) return null;
  if(t.tpl && t.frameW && (t.frameW!==frame.w||t.frameH!==frame.h)) return null;
  // 기본 아이콘은 UI 배율이 달라도 찾도록 여러 크기로 검색. 한 번 찾으면 그 크기부터 먼저 확인
  const P=t.preset&&PRESETS[t.preset];
  const cands=t.tpl?[t.tpl]:P.icons.flatMap(p=>P.scales.map(s=>({...p,s})));
  const st=stateOf(t.id), hit=st.hit&&cands.find(x=>x.url===st.hit.url&&x.s===st.hit.s);
  const order=hit?[hit,...cands.filter(x=>x!==hit)]:cands;
  const band=KINDS[t.kind]&&KINDS[t.kind].timerBand||null;   // 버프: 남은 시간 숫자 띠를 빼고 비교
  let best=null;
  for(const c of order){
    const tp=loadTpl(c,band); if(!tp) continue;
    if(best&&best.score>=t.threshold&&c!==order[0]) break;
    const W=Math.round(a.w*tp.k), H=Math.round(a.h*tp.k);
    const {work,wctx}=scratch(); work.width=W; work.height=H; wctx.drawImage(source,a.x,a.y,a.w,a.h,0,0,W,H);
    const r=matchTemplate(toGray(wctx.getImageData(0,0,W,H).data,W*H),W,H,tp);
    let score=r.score, x=a.x+r.x/tp.k, y=a.y+r.y/tp.k;
    if(tp.full){ const f=refineAt(source,tp.full,x,y,Math.ceil(1/tp.k)+1); if(f){ score=f.score; x=f.x; y=f.y; } }
    const pos={x:x-tp.m,y:y-tp.m,w:c.w*(c.s||1),h:c.h*(c.s||1)};
    if(P&&!t.tpl&&P.fill&&!fillAt(source,pos,P.fill)) score=0;   // 내장 룬: 모양은 비슷해도 안쪽 색이 다르면 룬이 아니다
    if(!best||score>best.score) best={score,t:c,pos};
  }
  if(best&&best.score>=t.threshold) st.hit={url:best.t.url,s:best.t.s};
  return best;
}
// “남은시간” 글자 오른쪽의 숫자 영역을 원본 해상도로 잘라 읽기
export function readTimer(source, p){
  const x0=Math.round(p.x+p.w*1.05), x1=Math.round(p.x+p.w*2.75), y0=Math.round(p.y), y1=Math.round(p.y+p.h*2.0);
  const W=Math.min(x1,frame.w)-x0, H=Math.min(y1,frame.h)-y0; if(W<10||H<8||x0<0||y0<0) return null;
  const {work,wctx}=scratch(); work.width=W; work.height=H; wctx.drawImage(source,x0,y0,W,H,0,0,W,H);
  return {rect:{x:x0,y:y0,w:W,h:H}, read:ocrSevenSeg(wctx.getImageData(0,0,W,H).data,W,H)};
}
// 거의 검은 프레임(맵 이동 중 암전, 창 최소화 등)인지. 이때 감지하면 버프가 꺼진 것으로 오판하므로 건너뜀
export function isBlank(s){
  const [w,h]=dims(s); if(!w||!h) return true;
  const {work,wctx}=scratch(); work.width=64; work.height=36; wctx.drawImage(s,0,0,w,h,0,0,64,36);
  const p=wctx.getImageData(0,0,64,36).data;
  for(let i=0;i<p.length;i+=4) if(0.299*p[i]+0.587*p[i+1]+0.114*p[i+2]>=8) return false;
  return true;
}
// 종류의 step이 돌려준 이벤트를 알림 후보로 모은다. events에 선언된 키만 알림이 되고(appear-unknown 같은 내부 이벤트는 버림), effect는 종류가 처리한다
export function collectEvents(t,evs,out){
  const k=KINDS[t.kind];
  for(const ev of evs){
    const e=typeof ev==='string'?{key:ev}:ev;
    if(e.effect){ k.applyEffect(t,e); continue; }
    const def=k.events.find(x=>x.key===e.key); if(def) out.push({t,def,info:e.info||{}});
  }
}
export function reqFor(t,def,info,rank){
  return {src:'target',id:t.id,event:def.key,text:def.msg(t,info||{}),beep:def.beep,slot:def.noSlot?null:`${t.id}.${def.key}`,mode:'full',flash:'card-'+t.id,
    group:def.group?{cls:def.group,label:sayName(t),rank:rank==null?(t.p.leadSec||0):rank,order:store.targets.indexOf(t)}:null};
}
// 이번 틱의 이벤트를 알림으로 보낸다. 묶기가 켜져 있으면 미리 알림이 난 틱에 곧 끝나는 다른 대상을 같이 묶는다(당겨 알림)
export function dispatchEvents(list,now){
  const reqs=list.map(x=>reqFor(x.t,x.def,x.info));
  if(store.group.on){
    const fired=list.filter(x=>x.def.group==='pre').map(x=>x.t.id);
    for(const p of planGroup(fired,store.targets,states,KINDS,now,store.group.windowSec).pulled){
      const t=targetById(p.id), k=KINDS[t.kind];
      k.markPre(stateOf(t.id),now);                     // 당겨 알린 주기는 자체 pre·꺼짐 알림을 다시 울리지 않는다
      reqs.push(reqFor(t,k.events.find(e=>e.group==='pre'),{},p.rank));
    }
  }
  for(const r of reqs) Alerts.fire(r);
}
// 카드의 "알림 테스트": 묶지 않고 첫 이벤트를 개별 알림으로 재생
export function testAlert(t){ const def=KINDS[t.kind].events[0]; Alerts.fire({...reqFor(t,def,{}),src:'test',group:null}); }
export const slowWatch=createSlowWatch(450,20);
export let busy=false;
export async function tick(){
  if(busy) return; busy=true;
  try{
    const t0=performance.now(), now=Date.now(), g=await grab(), source=g.frame; setFrameFresh(g.fresh);
    batch(()=>{   // 이번 틱에 바뀐 상태줄·카드·알림 문구를 한 번에 그린다
      if(source){ [frame.w,frame.h]=dims(source); }
      const live=!!src&&src.type==='stream', ok=!!source&&!(live&&isBlank(source));
      if(live){   // 화면 안 들어옴은 상태줄에만 표시(소리 알림은 없음, 2026-11-10 사용자 결정)
        if(ok){ health.okAt=now; health.badSince=null; health.badWarned=false; }
        else { health.badSince=health.badSince||now; if(now-health.badSince>=STALL_MS) health.badWarned=true; }
      }
      const evq=[], ctx=viewCtx();
      for(const t of store.targets){
        const k=KINDS[t.kind]; if(!k) continue;
        const st=stateOf(t.id);
        if(ok && t.enabled && !reg){
          const d0=performance.now(), det=k.detect(t,source,ctx);
          if(det){ st.score=det.score; st.pos=det.pos; collectEvents(t,k.step(t,st,det,source,now,ctx),evq); }
          else if(k.onSkip) collectEvents(t,k.step(t,st,null,source,now,ctx),evq);
          const dt=performance.now()-d0; st.ms=st.ms==null?dt:st.ms*0.8+dt*0.2;     // 대상별 감지 시간(지수 이동 평균). 카드에 표시
        } else if(k.onSkip && t.enabled) collectEvents(t,k.step(t,st,null,null,now,ctx),evq);   // 감지를 건너뛴 틱에도 부르는 종류(묶음 3)
      }
      dispatchEvents(evq,now);
      const slow=ok&&live?slowWatch.push(performance.now()-t0):null;
      if(slow) setNote(`감지가 느려요 (평균 ${slow} ms) · 사용 안 하는 대상은 꺼 주세요`);
      renderWatch();   // 탭 제목은 숨겨져 있어도 갱신
      pipUpdate(Date.now());   // 작은 창도 숨겨진 동안이 주 사용 조건이라 매 틱 갱신(묶음 5)
      if(!document.hidden){ drawPreview(source); if(live&&ok) pulse(); }
    });
  } finally { busy=false; Alerts.flush(Date.now()); }
}
