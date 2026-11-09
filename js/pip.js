/* ===== 작은 창(Document Picture-in-Picture, 묶음 5): 상태를 항상 위 창에 보이고, 알림이 울리면 그 행을 깜빡인다.
   읽기 전용이고 새 알림을 만들지 않는다. 깜빡임은 Alerts.listen으로 받은 알림에서만 시작한다(스펙 검토 6) ===== */
const PIP_FLASH_MS=5000;      // 깜빡임은 5초까지(접근성), 그 뒤에는 고정 색
const PIP_HOLD_MS=30000;      // 알림 뒤 30초 동안 그 행을 강조
const PIP_KIND={pre:'pre',gone:'gone',end:'gone',next1:'gone',next2:'gone',appear:'info',remind:'info',ready:'info',lost:'bad',stall:'bad',unread:'bad',alarm:'bad',busy:'bad'};
const PIP_MARK={pre:'!',gone:'✕',info:'◆',bad:'⚠'};   // 색만으로 구분하지 않게 행 앞 기호
function pipFlashKind(ev){ return PIP_KIND[ev]||null; }
// 대상 행(targetSnapshot)과 수동 타이머로 PIP 행을 만든다
function buildPipRows(snapRows,timers,now){
  const rows=snapRows.map(r=>({id:r.id,label:r.name,
    stateText:!r.enabled?'꺼둠':r.remainSec!=null?(r.statusCls==='alert'?'곧 끝나요':'켜짐'):r.statusText,
    remainText:r.enabled&&r.remainSec!=null?fmt(r.remainSec):'',
    level:!r.enabled?'idle':['reg','rereg','unseen'].includes(r.stripState)?'warn':r.statusCls==='alert'?'alert':r.statusCls==='on'?'ok':'idle'}));
  for(const t of timers||[]){
    const rem=manualRemainMs(t,now);
    rows.push({id:t.id,label:t.kind==='routine'?`${t.label} · ${t.phases[t.idx].name}`:t.label,
      stateText:{running:'실행 중',paused:'멈춤',idle:'대기',done:'끝났어요'}[t.status],remainText:t.status==='done'?'':manualFmt(rem),
      level:t.status==='running'&&t.preSec&&rem<=t.preSec*1000?'warn':t.status==='running'?'ok':'idle'});
  }
  return rows;
}
// 알림 뒤 5초는 깜빡임, 30초까지는 같은 색 고정, 그 뒤에는 행의 원래 수준. 움직임 줄이기면 처음부터 고정
function pipLevel(row,flash,now,reduce){
  if(flash){ const dt=now-flash.at;
    if(dt<PIP_FLASH_MS&&!reduce) return {cls:'flash-'+flash.kind,mark:PIP_MARK[flash.kind]};
    if(dt<PIP_HOLD_MS) return {cls:'hold-'+flash.kind,mark:PIP_MARK[flash.kind]}; }
  return {cls:'lv-'+row.level,mark:''};
}

/* ----- 창 ----- */
let pipWin=null, pipResizeTimer=null;
const pipFlash={};            // 행 id(또는 맨 위 줄 'sys') → {kind, at}
const pipSupported=()=>!!(window.documentPictureInPicture&&typeof window.documentPictureInPicture.requestWindow==='function');
const PIP_CSS=`
:root{color-scheme:light;--paper:#f8f3fa;--paper-2:#efe8f2;--paper-3:#e4dce8;--rule:#d3c9da;--ink:#1d0f25;--ink-2:#3d2f46;--muted:#615569;
  --ok:#456700;--warn:#c12100;--ember:#f24700;--info:#00b7c1;--accent-ink:#1d0f25;
  --display:"Black Han Sans","Malgun Gothic","Apple SD Gothic Neo",sans-serif;--body:"Pretendard","Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.35 var(--body);border:2px solid var(--rule);min-height:100vh}
#pipStatus,.r{position:relative;display:flex;gap:8px;align-items:baseline;padding:8px 12px;border-bottom:1px solid var(--rule);min-height:34px}
:where(#pipStatus){background:var(--paper-2);color:var(--ink);border-bottom:2px solid var(--rule);font:16px/1.3 var(--display)}
:where(#pipStatus).bad{background:var(--ember);color:var(--accent-ink);border-bottom-color:var(--accent-ink)}
.r .l{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.r .s{color:var(--muted);white-space:nowrap}.r .t{font-weight:700;font-variant-numeric:tabular-nums;min-width:3.2em;text-align:right}
.r .m{font-weight:700;min-width:.8em}.r>span{position:relative;z-index:1}
.lv-ok .s{color:var(--ok)}.lv-warn .s,.lv-alert .s,.lv-alert .t{color:var(--warn)}.lv-idle .l,.lv-idle .t{color:var(--ink-2)}
.flash-pre,.hold-pre{background:var(--ember);color:var(--accent-ink)}.flash-gone,.hold-gone{background:var(--ink-2);color:var(--paper)}
.flash-info,.hold-info{background:var(--info);color:var(--accent-ink)}.flash-bad,.hold-bad{background:repeating-linear-gradient(135deg,var(--paper-3) 0 8px,var(--rule) 8px 16px);color:var(--ink)}
[class*=flash-] .s,[class*=hold-] .s,[class*=flash-] .t,[class*=hold-] .t{color:inherit}
[class*=flash-]::after{content:"";position:absolute;inset:0;background:var(--paper);animation:pipblink 1s step-end infinite}
@keyframes pipblink{0%{opacity:0}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){[class*=flash-]::after{animation:none;opacity:0}}`;
// 작은 창 문서는 about:blank라 상대 경로가 안 풀린다. 표시 글꼴은 절대 주소(Google Fonts)로 건다(못 읽으면 시스템 고딕)
const pipFontCss=()=>'@import url("https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap");';
function pipInit(){
  const b=$('#btnPip');
  if(!pipSupported()){ b.disabled=true; $('#pipNote').hidden=false; return; }
  b.disabled=false; $('#pipNote').hidden=true;
  b.onclick=()=>{ if(pipWin) pipClose(); else pipOpen(); };   // requestWindow는 클릭 안에서만 부른다
  if(!pipInit.listening){ pipInit.listening=true;
    Alerts.listen(rec=>{
      if(rec.event==='back'){ delete pipFlash.sys; return; }
      const k=pipFlashKind(rec.event); if(!k) return;
      for(const id of rec.ids) pipFlash[rec.src==='system'?'sys':id]={kind:k,at:rec.at};
      pipUpdate(Date.now());
    }); }
}
async function pipOpen(){
  const n=store.targets.length+(typeof manual!=='undefined'?manual.timers.length:0);
  const size=ui.pip&&ui.pip.w?ui.pip:{w:260,h:44+34*Math.min(8,Math.max(1,n))};
  let w;
  try{ w=await window.documentPictureInPicture.requestWindow({width:size.w,height:size.h}); }
  catch(e){ setNote('작은 창을 열지 못했어요. 한 번 더 눌러 주세요'); return; }
  pipWin=w; const d=w.document;
  d.title='재획 알리미'; d.documentElement.lang='ko';
  const st=d.createElement('style'); st.textContent=pipFontCss()+PIP_CSS; d.head.append(st);
  d.body.innerHTML='<div id="pipStatus"></div><div id="pipRows"></div>';
  w.addEventListener('pagehide',()=>{ pipRemember(); pipWin=null; setText($('#btnPip'),'작은 창 열기'); });
  w.addEventListener('resize',()=>{ clearTimeout(pipResizeTimer); pipResizeTimer=setTimeout(pipRemember,400); });   // 크기는 다음에 열 때 쓴다
  setText($('#btnPip'),'작은 창 닫기');
  pipUpdate(Date.now());
}
function pipRemember(){ if(pipWin&&pipWin.innerWidth){ ui.pip={w:Math.round(pipWin.innerWidth),h:Math.round(pipWin.innerHeight)}; saveUi(); } }
function pipClose(){ pipRemember(); const w=pipWin; pipWin=null; try{ w&&w.close(); }catch(e){} setText($('#btnPip'),'작은 창 열기'); }
// tick마다(탭이 숨겨져 있어도) 부른다. 바뀐 글자·클래스만 쓴다. 화면 낭독기가 매번 읽지 않게 aria-live는 두지 않는다
function pipUpdate(now){
  if(!pipWin) return;
  const d=pipWin.document, reduce=!!(pipWin.matchMedia&&pipWin.matchMedia('(prefers-reduced-motion: reduce)').matches);
  for(const k of Object.keys(pipFlash)) if(now-pipFlash[k].at>=PIP_HOLD_MS) delete pipFlash[k];
  const ws=watchStatus(), top=d.getElementById('pipStatus'); if(!top) return;
  const tl=pipLevel({level:ws.cls==='bad'?'alert':'ok'},pipFlash.sys,now,reduce);
  setText(top,(tl.mark?tl.mark+' ':'')+ws.state); const tc=(ws.cls==='bad'?'bad ':'')+tl.cls; if(top.className!==tc) top.className=tc;
  const rows=buildPipRows(snapshotNow(),typeof manual!=='undefined'?manual.timers:[],now), box=d.getElementById('pipRows'), keep=new Set();
  for(const r of rows){
    keep.add(r.id);
    let el=box.querySelector(`[data-id="${r.id}"]`);
    if(!el){ el=d.createElement('div'); el.dataset.id=r.id; el.innerHTML='<span class="m"></span><span class="l"></span><span class="s"></span><span class="t"></span>'; }
    if(box.children[[...keep].length-1]!==el) box.insertBefore(el,box.children[[...keep].length-1]||null);   // 순서 맞추기
    const lv=pipLevel(r,pipFlash[r.id],now,reduce), cls='r '+lv.cls;
    if(el.className!==cls) el.className=cls;
    setText(el.children[0],lv.mark); setText(el.children[1],r.label); setText(el.children[2],r.stateText); setText(el.children[3],r.remainText);
  }
  for(const el of [...box.children]) if(!keep.has(el.dataset.id)) el.remove();
}
if(typeof module==='object') module.exports={buildPipRows,pipFlashKind,pipLevel};
