/* ----- 미리보기 & 드래그 등록 ----- */
const pv=$('#preview'), pctx=pv.getContext('2d');
let reg=null; // {def, step:'area'|'icon', snap:canvas, area, drag}
function drawPreview(source){
  const s = reg ? reg.snap : source; if(!s) return;
  const [w,h]=dims(s); if(!w) return;
  if(pv.width!==w||pv.height!==h){ pv.width=w; pv.height=h; }
  pctx.drawImage(s,0,0);
  const lw=Math.max(2,w/600); pctx.lineWidth=lw; pctx.font=`${Math.round(lw*7)}px sans-serif`;
  const placed=[];
  if(!reg) for(const d of DEFS){ const c=cfgs[d.id], st=states[d.id], ar=areaOf(d.id); if(!ar) continue;
    pctx.setLineDash([lw*3,lw*2]); pctx.strokeStyle='rgba(255,255,255,.55)'; pctx.strokeRect(ar.x,ar.y,ar.w,ar.h);
    pctx.setLineDash([]); pctx.fillStyle='rgba(255,255,255,.8)'; pctx.fillText(d.name,ar.x+2,ar.y+lw*8);
    if(st.pos&&src){ const hit=st.score>=c.threshold;
      pctx.strokeStyle=hit?'#3ccf7d':'rgba(255,107,107,.7)'; pctx.strokeRect(st.pos.x,st.pos.y,st.pos.w,st.pos.h);
      // 기준값을 맞출 때 카드와 캔버스를 오가지 않도록 일치도/기준값을 박스 바로 아래에 표시
      const label=`${d.name} ${st.score.toFixed(2)} / ${c.threshold.toFixed(2)}`, fs=Math.round(lw*9);
      pctx.save(); pctx.font=`600 ${fs}px sans-serif`;
      const bw=pctx.measureText(label).width+lw*4, bh=fs+lw*3;
      let ly=st.pos.y+st.pos.h+lw*2; if(ly+bh>h) ly=Math.max(0,st.pos.y-bh-lw*2);
      const lx=Math.min(Math.max(0,st.pos.x),w-bw);
      while(placed.some(p=>lx<p.x+p.w&&p.x<lx+bw&&ly<p.y+p.h&&p.y<ly+bh)) ly+=bh+lw;   // 다른 대상의 표시와 겹치면 아래로 비킴
      placed.push({x:lx,y:ly,w:bw,h:bh});
      pctx.fillStyle='rgba(0,0,0,.75)'; pctx.fillRect(lx,ly,bw,bh);
      pctx.fillStyle=hit?'#3ccf7d':'#ff8a8a'; pctx.fillText(label,lx+lw*2,ly+fs+lw/2);
      pctx.restore(); }
    if(st.ocrRect&&src){ pctx.strokeStyle='#f0c040'; pctx.strokeRect(st.ocrRect.x,st.ocrRect.y,st.ocrRect.w,st.ocrRect.h); } }
  if(reg){
    pctx.setLineDash([]);
    if(reg.area){ pctx.strokeStyle='#6aa1ff'; pctx.strokeRect(reg.area.x,reg.area.y,reg.area.w,reg.area.h); }
    if(reg.drag){ const r=norm(reg.drag); pctx.strokeStyle='#f08a45'; pctx.strokeRect(r.x,r.y,r.w,r.h); }
  }
}
function norm(g){ return {x:Math.round(Math.min(g.x0,g.x1)),y:Math.round(Math.min(g.y0,g.y1)),w:Math.round(Math.abs(g.x1-g.x0)),h:Math.round(Math.abs(g.y1-g.y0))}; }
async function snapshot(){
  const s=await grab(); if(!s) return null; const [w,h]=dims(s);
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h; cv.getContext('2d').drawImage(s,0,0); return cv;
}
async function startRegister(d){
  if(!src){ setNote(`${d.name} 등록은 게임 화면을 연결하거나 스크린샷을 불러온 뒤에 할 수 있어요`); return; }
  setNote('');
  const snap=await snapshot(); if(!snap) return;
  reg={def:d,step:'area',snap,area:null,drag:null}; updateBanner(); drawPreview(null);
  $('#stage').scrollIntoView({behavior:'smooth',block:'center'});
}
function updateBanner(){
  const b=$('#banner'); if(!reg){ b.classList.remove('on'); return; }
  b.classList.add('on');
  $('#bannerText').textContent = reg.step==='area'
    ? `${reg.def.name} ① ${reg.def.areaLabel}을 넉넉하게 드래그하세요`
    : `${reg.def.name} ② ${reg.def.iconLabel} 하나만 꼭 맞게 드래그하세요`;
}
function toImg(e){ const r=pv.getBoundingClientRect(); return {x:(e.clientX-r.left)*pv.width/r.width, y:(e.clientY-r.top)*pv.height/r.height}; }
function initRegister(){
$('#btnCancel').onclick=()=>{ reg=null; updateBanner(); };
$('#btnRetake').onclick=async()=>{ if(!reg) return; const s=await snapshot(); if(s){ reg.snap=s; drawPreview(null); } };
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&reg){ reg=null; updateBanner(); } });
pv.addEventListener('pointerdown',e=>{ if(!reg) return; const p=toImg(e); reg.drag={x0:p.x,y0:p.y,x1:p.x,y1:p.y}; pv.setPointerCapture(e.pointerId); });
pv.addEventListener('pointermove',e=>{ if(!reg||!reg.drag) return; const p=toImg(e); reg.drag.x1=p.x; reg.drag.y1=p.y; drawPreview(null); });
pv.addEventListener('pointerup',()=>{
  if(!reg||!reg.drag) return; const r=norm(reg.drag); reg.drag=null;
  if(r.w<6||r.h<6){ drawPreview(null); return; }
  if(reg.step==='area'){ reg.area=r; reg.step='icon'; updateBanner(); drawPreview(null); return; }
  // 아이콘: 영역 밖으로 나가면 영역을 넓힘
  const a=reg.area, x0=Math.min(a.x,r.x), y0=Math.min(a.y,r.y), x1=Math.max(a.x+a.w,r.x+r.w), y1=Math.max(a.y+a.h,r.y+r.h);
  const cv=document.createElement('canvas'); cv.width=r.w; cv.height=r.h; cv.getContext('2d').drawImage(reg.snap,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
  const c=cfgs[reg.def.id];
  Object.assign(c,{area:{x:x0,y:y0,w:x1-x0,h:y1-y0},tpl:{url:cv.toDataURL('image/png'),w:r.w,h:r.h},frameW:reg.snap.width,frameH:reg.snap.height});
  save(); states[reg.def.id]=newState(); states[reg.def.id].armed = src&&src.type==='image';
  const d=reg.def; reg=null; updateBanner(); renderCard(d); renderWatch(); setNote(`${d.name} 등록했어요`,'info');
});
}
