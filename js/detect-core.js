// 켜짐/꺼짐 판정과 타이머 상태기계 (화면 없이도 테스트 가능하도록 순수 함수)
function stepDetector(st, cfg, matched, now){
  const ev=[]; const need = cfg.kind==='buff' ? {on:2,off:4} : {on:2,off:4};
  if(matched){ st.onStreak++; st.offStreak=0; } else { st.offStreak++; st.onStreak=0; }
  if(!st.present && st.onStreak>=need.on){
    st.present=true; st.presentAt=now;
    if(st.armed){ st.appearedAt=now; st.alertedPre=false; st.preMarkRemain=0; ev.push('appear'); }
    else { st.appearedAt=null; ev.push('appear-unknown'); }   // 연결 시점에 이미 켜져 있던 경우
    st.lastRemind=now;
  } else if(st.present && st.offStreak>=need.off){
    st.present=false;
    if(cfg.kind==='countdown' && !st.alertedPre) ev.push('gone');
    if(cfg.kind==='buff'){
      if(!cfg.durationSec && st.appearedAt){
        const d=Math.round((now-st.appearedAt)/1000 - need.off*0.5);
        if(d>=15) ev.push({learn:d});
      }
      if(!st.alertedPre) ev.push('gone');
    }
    st.appearedAt=null; st.alertedPre=false; st.preMarkRemain=0;
  }
  if(!st.present && st.offStreak>=need.off) st.armed=true;   // 확실히 꺼진 걸 본 뒤부터 켜짐 시각을 신뢰
  if(st.present && cfg.kind==='buff' && st.appearedAt && cfg.durationSec && !st.alertedPre){
    const endAt=st.appearedAt+cfg.durationSec*1000;
    if(now>=endAt-cfg.leadSec*1000){ st.alertedPre=true; ev.push('pre'); }
  }
  if(st.present && cfg.kind==='rune' && cfg.repeatSec>0 && now-st.lastRemind>=cfg.repeatSec*1000){
    st.lastRemind=now; ev.push('remind');
  }
  return ev;
}
function newState(){ return {present:false,seen:false,presentAt:null,onStreak:0,offStreak:0,armed:false,appearedAt:null,alertedPre:false,preMarkRemain:0,lastRemind:0,score:0,pos:null,remain:null,remainAt:0,cand:null,candAt:0,lastText:'',lastReadAt:null,ocrWarned:false}; }

/* ===== 부스터 타이머 숫자 읽기 (7세그먼트) ===== */
// 노란/흰 7세그먼트 숫자(검은 배경)를 읽어 {value, text} 반환. 못 읽으면 null
const SEG_DIGITS={'1111110':'0','0110000':'1','1101101':'2','1111001':'3','0110011':'4','1011011':'5','1011111':'6','0011111':'6',
  '1110000':'7','1110010':'7','1111111':'8','1111011':'9','1110011':'9'};
function ocrSevenSeg(rgba, W, H, litMin=110){
  const lit=new Uint8Array(W*H);
  for(let i=0,j=0;i<W*H;i++,j+=4) lit[i]=(0.299*rgba[j]+0.587*rgba[j+1]+0.114*rgba[j+2])>litMin?1:0;
  const runs=[]; let cur=null;
  for(let x=0;x<W;x++){
    let n=0,top=H,bot=-1; for(let y=0;y<H;y++) if(lit[y*W+x]){n++; if(y<top)top=y; bot=y;}
    if(n>=2){ if(!cur){cur={l:x,r:x,t:top,b:bot};runs.push(cur);} else {cur.r=x; cur.t=Math.min(cur.t,top); cur.b=Math.max(cur.b,bot);} }
    else cur=null;
  }
  runs.forEach(r=>{r.w=r.r-r.l+1; r.h=r.b-r.t+1;});
  const maxH=Math.max(0,...runs.map(r=>r.h)); if(maxH<8) return null;
  const digs=runs.filter(r=>r.h>=0.7*maxH); if(!digs.length) return null;
  const top=Math.min(...digs.map(r=>r.t)), bot=Math.max(...digs.map(r=>r.b)), Hc=bot-top+1;
  let cw=Math.max(...digs.map(r=>r.w)); if(cw<0.4*Hc) cw=Math.round(0.55*Hc);
  const frac=(x0,x1,y0,y1)=>{ x0=Math.max(0,Math.round(x0)); x1=Math.min(W-1,Math.round(x1)); y0=Math.max(0,Math.round(y0)); y1=Math.min(H-1,Math.round(y1));
    let n=0,on=0; for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){ n++; on+=lit[y*W+x]; } return n?on/n:0; };
  let text='';
  for(const r of runs){
    if(r.h>=0.7*maxH){
      const x0=r.w>=0.75*cw ? r.l : r.r-cw+1, X=f=>x0+f*(cw-1), Y=f=>top+f*(Hc-1);
      const seg=[ frac(X(.3),X(.7),Y(0),Y(.12)), frac(X(.8),X(1),Y(.15),Y(.4)), frac(X(.8),X(1),Y(.6),Y(.85)),
                  frac(X(.3),X(.7),Y(.88),Y(1)), frac(X(0),X(.2),Y(.6),Y(.85)), frac(X(0),X(.2),Y(.15),Y(.4)), frac(X(.3),X(.7),Y(.44),Y(.56)) ];
      const ch=SEG_DIGITS[seg.map(v=>v>0.3?1:0).join('')]; if(ch===undefined) return null; text+=ch;
    } else if(text && r.h<=0.3*maxH && r.w<=0.5*maxH && r.b>=bot-0.2*Hc && !text.includes('.')) text+='.';
  }
  if(text.endsWith('.')) text=text.slice(0,-1);
  if(!/^\d+(\.\d+)?$/.test(text)) return null;
  return {value:parseFloat(text), text};
}
// 읽은 숫자로 남은 시간 갱신. 잘못 읽은 값 하나로 알림이 울리지 않도록, 예상값과 맞거나 두 번 연속 일치할 때만 받아들임
const UNREAD_MS=20000;   // 켜져 있는데 이만큼 숫자를 못 읽으면 미리 알림을 못 하므로 한 번 알림
function stepCountdown(st, cfg, value, now){
  const ev=[];
  if(!st.present){ st.remain=null; st.cand=null; st.lastReadAt=null; st.ocrWarned=false; return ev; }
  if(st.lastReadAt==null) st.lastReadAt=st.presentAt ?? now;
  if(value==null){
    if(!st.ocrWarned && now-st.lastReadAt>=UNREAD_MS){ st.ocrWarned=true; ev.push('unread'); }
    return ev;
  }
  st.lastReadAt=now; st.ocrWarned=false;
  const exp=st.remain!=null ? st.remain-(now-st.remainAt)/1000 : null;
  const candExp=st.cand!=null ? st.cand-(now-st.candAt)/1000 : null;
  const ok=(exp!=null && Math.abs(value-exp)<=2) || (candExp!=null && Math.abs(value-candExp)<=1);
  if(!ok){ st.cand=value; st.candAt=now; return ev; }
  st.remain=value; st.remainAt=now; st.cand=null;
  // 새 부스터를 썼으면 다시 알림 준비. 묶기로 미리 당겨 알린 주기(preMarkRemain)는 그 값보다 훨씬 커져야 새 주기로 본다
  if(value>Math.max(cfg.leadSec,st.preMarkRemain||0)+5){ st.alertedPre=false; st.preMarkRemain=0; }
  if(value<=cfg.leadSec && value>0 && !st.alertedPre){ st.alertedPre=true; st.preMarkRemain=value; ev.push('pre'); }
  return ev;
}
if(typeof module==='object') module.exports={stepDetector,newState,SEG_DIGITS,ocrSevenSeg,UNREAD_MS,stepCountdown};
