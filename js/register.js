/* ----- 미리보기 & 드래그 등록 ----- */
const pv=$('#preview'), pctx=pv.getContext('2d');
let reg=null; // {t, steps, i, snap, rects:{area?,icon?}, drag, msg, fresh}  fresh: 방금 만든 대상의 첫 등록(취소하면 대상도 지운다)
function drawPreview(source){
  const s = reg ? reg.snap : source; if(!s) return;
  const [w,h]=dims(s); if(!w) return;
  if(pv.width!==w||pv.height!==h){ pv.width=w; pv.height=h; }
  pctx.drawImage(s,0,0);
  const lw=Math.max(2,w/600); pctx.lineWidth=lw; pctx.font=`${Math.round(lw*7)}px sans-serif`;
  const placed=[];
  if(!reg) for(const t of store.targets){ const st=stateOf(t.id), ar=KINDS[t.kind]?areaOf(t):null; if(!ar) continue;
    pctx.setLineDash([lw*3,lw*2]); pctx.strokeStyle='rgba(255,255,255,.55)'; pctx.strokeRect(ar.x,ar.y,ar.w,ar.h);
    pctx.setLineDash([]); pctx.fillStyle='rgba(255,255,255,.8)'; pctx.fillText(t.name,ar.x+2,ar.y+lw*8);
    if(st.pos&&src){ const hit=st.score>=t.threshold;
      pctx.strokeStyle=hit?'#3ccf7d':'rgba(255,107,107,.7)'; pctx.strokeRect(st.pos.x,st.pos.y,st.pos.w,st.pos.h);
      // 기준값을 맞출 때 카드와 캔버스를 오가지 않도록 일치도/기준값을 박스 바로 아래에 표시
      const label=`${t.name} ${st.score.toFixed(2)} / ${t.threshold.toFixed(2)}`, fs=Math.round(lw*9);
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
    if(reg.rects.area){ pctx.strokeStyle='#6aa1ff'; pctx.strokeRect(reg.rects.area.x,reg.rects.area.y,reg.rects.area.w,reg.rects.area.h); }
    if(reg.drag){ const r=norm(reg.drag); pctx.strokeStyle='#f08a45'; pctx.strokeRect(r.x,r.y,r.w,r.h); }
  }
}
function norm(g){ return {x:Math.round(Math.min(g.x0,g.x1)),y:Math.round(Math.min(g.y0,g.y1)),w:Math.round(Math.abs(g.x1-g.x0)),h:Math.round(Math.abs(g.y1-g.y0))}; }
async function snapshot(){
  const s=(await grab()).frame; if(!s) return null; const [w,h]=dims(s);
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h; cv.getContext('2d').drawImage(s,0,0); return cv;
}
async function startRegister(t,opts={}){
  if(!src){ setNote(`${t.name} 등록은 게임 화면을 연결하거나 스크린샷을 불러온 뒤에 할 수 있어요`); return; }
  setNote('');
  const snap=await snapshot(); if(!snap) return;
  if(reg) cancelRegister();   // 다른 대상을 등록 중이었으면 그만둔다(첫 등록이었으면 그 대상은 지워진다)
  reg={t,steps:KINDS[t.kind].register.steps,i:0,snap,rects:{},drag:null,msg:'',fresh:!!opts.fresh}; updateBanner(); drawPreview(null);
  $('#stage').scrollIntoView({behavior:'smooth',block:'center'});
}
const STEP_TEXT={ area:l=>`${l.area}을 넉넉하게 드래그하세요`, icon:l=>`${l.icon} 하나만 꼭 맞게 드래그하세요` };
function updateBanner(){
  const b=$('#banner'); if(!reg){ b.classList.remove('on'); return; }
  b.classList.add('on');
  $('#bannerText').textContent=(reg.msg?`⚠ ${reg.msg} · `:'')+`${reg.t.name} ${'①②③'[reg.i]} ${STEP_TEXT[reg.steps[reg.i]](labelsOf(reg.t))}`;
}
function cancelRegister(){
  const r=reg; reg=null; updateBanner();
  if(r&&r.fresh){ removeTargetNow(r.t); setNote(`${r.t.name} 등록을 취소해서 목록에서 뺐어요`,'info'); }   // 빈 "등록 필요" 카드가 쌓이지 않게
}
// 모든 단계를 마치면 종류의 검사(validate)를 거쳐 저장(save). 검사에 걸리면 이유를 배너에 보이고 처음 단계부터 다시 드래그
function finishRegister(){
  const t=reg.t, k=KINDS[t.kind], why=k.register.validate(t,reg.rects,reg.snap);
  if(why){ reg.msg=why; reg.rects={}; reg.i=0; updateBanner(); drawPreview(null); return; }
  k.register.save(t,reg.rects,reg.snap); saveTargets();
  states[t.id]=newState(); states[t.id].armed=!!(src&&src.type==='image');
  reg=null; updateBanner(); renderCard(t); renderWatch(); setNote(`${t.name} 등록했어요`,'info');
}
function toImg(e){ const r=pv.getBoundingClientRect(); return {x:(e.clientX-r.left)*pv.width/r.width, y:(e.clientY-r.top)*pv.height/r.height}; }
function initRegister(){
$('#btnCancel').onclick=cancelRegister;
$('#btnRetake').onclick=async()=>{ if(!reg) return; const s=await snapshot(); if(s){ reg.snap=s; drawPreview(null); } };
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&reg) cancelRegister(); });
pv.addEventListener('pointerdown',e=>{ if(!reg) return; const p=toImg(e); reg.drag={x0:p.x,y0:p.y,x1:p.x,y1:p.y}; pv.setPointerCapture(e.pointerId); });
pv.addEventListener('pointermove',e=>{ if(!reg||!reg.drag) return; const p=toImg(e); reg.drag.x1=p.x; reg.drag.y1=p.y; drawPreview(null); });
pv.addEventListener('pointerup',()=>{
  if(!reg||!reg.drag) return; const r=norm(reg.drag); reg.drag=null;
  if(r.w<6||r.h<6){ drawPreview(null); return; }
  reg.rects[reg.steps[reg.i]]=r; reg.msg=''; reg.i++;
  if(reg.i<reg.steps.length){ updateBanner(); drawPreview(null); return; }
  finishRegister();
});
}
