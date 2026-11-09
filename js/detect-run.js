const states={}; const tplCache={};
function initStates(){ for(const d of DEFS) states[d.id]=newState(); }
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
const PRESET_SCALES=[1,1.25,1.5];
const defOf=id=>DEFS.find(d=>d.id===id);
const usingPreset=id=>!cfgs[id].tpl && !!defOf(id).presets;
function areaOf(id){
  const c=cfgs[id]; if(c.area&&c.tpl) return c.area;
  if(usingPreset(id)&&frame.w&&defOf(id).presetArea) return defOf(id).presetArea(frame);
  if(usingPreset(id)&&frame.w) return {x:Math.round(frame.w*0.35),y:0,w:Math.round(frame.w*0.65),h:Math.round(frame.h*0.3)};  // 버프창: 화면 오른쪽 위
  return null;
}
function detect(d, source){
  const c=cfgs[d.id], a=areaOf(d.id); if(!a) return null;
  if(c.tpl && c.frameW && (c.frameW!==frame.w||c.frameH!==frame.h)) return null;
  // 기본 아이콘은 UI 배율이 달라도 찾도록 여러 크기로 검색. 한 번 찾으면 그 크기부터 먼저 확인
  const cands=c.tpl?[c.tpl]:d.presets.flatMap(p=>(d.presetScales||PRESET_SCALES).map(s=>({...p,s})));
  const st=states[d.id], hit=st.hit&&cands.find(t=>t.url===st.hit.url&&t.s===st.hit.s);
  const order=hit?[hit,...cands.filter(t=>t!==hit)]:cands;
  let best=null;
  for(const t of order){
    const tp=loadTpl(t); if(!tp) continue;
    if(best&&best.score>=c.threshold&&t!==order[0]) break;
    const W=Math.round(a.w*tp.k), H=Math.round(a.h*tp.k);
    work.width=W; work.height=H; wctx.drawImage(source,a.x,a.y,a.w,a.h,0,0,W,H);
    const r=matchTemplate(toGray(wctx.getImageData(0,0,W,H).data,W*H),W,H,tp);
    if(!best||r.score>best.score) best={score:r.score,t,pos:{x:a.x+r.x/tp.k-tp.m,y:a.y+r.y/tp.k-tp.m,w:t.w*(t.s||1),h:t.h*(t.s||1)}};
  }
  if(best&&best.score>=c.threshold) st.hit={url:best.t.url,s:best.t.s};
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
let busy=false;
async function tick(){
  if(busy) return; busy=true;
  try{
    const now=Date.now(), source=await grab();
    if(source){ [frame.w,frame.h]=dims(source); }
    const live=!!src&&src.type==='stream', ok=!!source&&!(live&&isBlank(source));
    if(live){
      if(ok){ health.okAt=now; health.badSince=null; if(health.badWarned){ health.badWarned=false; fireSystem('back'); } }
      else { health.badSince=health.badSince||now; if(!health.badWarned && now-health.badSince>=STALL_MS){ health.badWarned=true; fireSystem('stall'); } }
    } else if(!src && health.lostAt && health.reminders<LOST_REMIND_MAX && now-health.remindAt>=LOST_REMIND_MS){
      health.reminders++; health.remindAt=now; fireSystem('lost');
    }
    for(const d of DEFS){
      const c=cfgs[d.id], st=states[d.id];
      if(ok && c.enabled && !reg){
        const r=detect(d,source);
        if(r){ st.score=r.score; st.pos=r.pos;
          const evs=stepDetector(st,c,r.score>=c.threshold,now); if(st.present) st.seen=true;
          if(d.kind==='countdown'){ const o=st.present&&r.score>=c.threshold?readTimer(source,r.pos):null; st.ocrRect=o&&o.rect; if(o&&o.read) st.lastText=o.read.text;
            evs.push(...stepCountdown(st,c,o&&o.read?o.read.value:null,now)); }
          for(const ev of evs){
            if(ev.learn){ c.durationSec=ev.learn; save(); const inp=document.querySelector(`#card-${d.id} [data-k=duration]`); if(inp) inp.value=fmt(ev.learn); }
            else if(ev==='pre'||ev==='gone'||ev==='remind'||ev==='unread'||(ev==='appear'&&d.kind==='rune')||(ev==='appear-unknown'&&d.kind==='rune')) fire(d,ev.startsWith('appear')?'appear':ev);
          }
        }
      }
      if(!document.hidden) renderCard(d);
    }
    renderWatch();   // 탭 제목은 숨겨져 있어도 갱신
    if(!document.hidden){ drawPreview(source); if(live&&ok) pulse(); }
  } finally { busy=false; }
}
