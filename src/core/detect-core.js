// 켜짐/꺼짐 판정과 타이머 상태기계 (화면 없이도 테스트 가능하도록 순수 함수)
// cfg.holdUntil(시각): 그때까지는 연속으로 안 보여도 꺼짐으로 보지 않고 가려진 것(st.held)으로 둔다. 카운트다운이 읽어 둔 남은 시간으로 정한다
export const HOLD_GRACE_MS=2000;   // 카운트다운: 읽어 둔 끝 시각보다 이만큼 더 기다린 뒤에 꺼짐으로 본다
export function stepDetector(st, cfg, matched, now){
  const ev=[]; const need = cfg.kind==='buff' ? {on:2,off:4} : {on:2,off:4};
  if(matched){ st.onStreak++; st.offStreak=0; st.held=false; } else { st.offStreak++; st.onStreak=0; }
  if(!st.present && st.onStreak>=need.on){
    st.present=true; st.presentAt=now;
    if(st.armed){ st.appearedAt=now; st.alertedPre=false; st.preMarkRemain=0; ev.push('appear'); }
    else { st.appearedAt=null; ev.push('appear-unknown'); }   // 연결 시점에 이미 켜져 있던 경우
    st.lastRemind=now;
  } else if(st.present && st.offStreak>=need.off && cfg.holdUntil && now<cfg.holdUntil){
    st.held=true;      // 화면 위쪽 가운데의 안내 글자·데미지 숫자 등에 잠깐 가려졌을 수 있다(2026-11-10 부스터 꺼짐 오판)
  } else if(st.present && st.offStreak>=need.off){
    st.present=false; st.held=false;
    // 꺼짐은 내부 이벤트(알림 아님). 버프의 지속시간 학습·미리 알림은 없앴다: 버프도 아이콘 숫자로 남은 시간을 센다(stepCountdown, 2026-11-11 사용자 결정)
    if((cfg.kind==='countdown'||cfg.kind==='buff') && !st.alertedPre) ev.push('gone');
    st.appearedAt=null; st.alertedPre=false; st.preMarkRemain=0;
  }
  if(!st.present && st.offStreak>=need.off) st.armed=true;   // 확실히 꺼진 걸 본 뒤부터 켜짐 시각을 신뢰
  if(st.present && cfg.kind==='rune' && cfg.repeatSec>0 && now-st.lastRemind>=cfg.repeatSec*1000){
    st.lastRemind=now; ev.push('remind');
  }
  return ev;
}
export function newState(){ return {present:false,held:false,seen:false,presentAt:null,onStreak:0,offStreak:0,armed:false,appearedAt:null,alertedPre:false,preMarkRemain:0,lastRemind:0,score:0,pos:null,remain:null,remainAt:0,cand:null,candAt:0,lastText:'',lastReadAt:null,ocrWarned:false}; }

/* ===== 부스터 타이머 숫자 읽기 (7세그먼트) ===== */
// 노란/흰 7세그먼트 숫자(검은 배경)를 읽어 {value, text} 반환. 못 읽으면 null
export const SEG_DIGITS={'1111110':'0','0110000':'1','1101101':'2','1111001':'3','0110011':'4','1011011':'5','1011111':'6','0011111':'6',
  '1110000':'7','1110010':'7','1111111':'8','1111011':'9','1110011':'9'};
export function ocrSevenSeg(rgba, W, H, litMin=110){
  const lit=new Uint8Array(W*H);
  for(let i=0,j=0;i<W*H;i++,j+=4) lit[i]=(0.299*rgba[j]+0.587*rgba[j+1]+0.114*rgba[j+2])>litMin?1:0;
  // 빈 행으로 나뉜 밝은 행 덩어리 중 가장 높은 것(숫자)만 남긴다. 숫자 바로 아래 한 행 띄워 붙는 퀘스트 진행 글자나
  // 위쪽 타이머 칸 테두리가 영역에 들어오면 열 구간이 숫자와 합쳐져 못 읽었다(2026-11-11 실제 화면). 7세그먼트 숫자는 획이 이어져 덩어리 안에 빈 행이 없다
  let band=null;
  for(let y=0,s=-1;y<=H;y++){
    const on=y<H&&lit.subarray(y*W,(y+1)*W).includes(1);
    if(on&&s<0) s=y; else if(!on&&s>=0){ if(!band||y-s>band[1]-band[0]) band=[s,y]; s=-1; }
  }
  if(!band) return null;
  lit.fill(0,0,band[0]*W); lit.fill(0,band[1]*W);
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
/* ===== 버프 아이콘의 남은 시간 숫자 읽기 (2026-11-11, 2026-11-12 실제 화면 공유에 맞춤) =====
   메이플은 버프 아이콘 가운데에 남은 시간을 검은 테두리의 노란 픽셀 글꼴(높이 9px)로 찍는다. 1분 미만은 "38", 1분 이상은 "2:07".
   글자 모양은 실제 화면에서 뽑았다(2026-11-11 스크린샷, 2026-11-12 화면 공유: 4와 1·6·9의 변형). 같은 숫자도 찍힌 자리에 따라 1px씩 달라 여러 모양을 둔다.
   브라우저 화면 공유는 밝기는 그대로 두고 색만 2×2 픽셀 단위로 줄여 넘긴다(2026-11-12 확인: 같은 글자의 밝기가 스크린샷과 같고 색만 다름).
   그래서 검은 테두리에 닿은 글자 가장자리와 콜론 점은 색이 바래 흰색에 가깝다. 픽셀마다 노란색인지 보면 글자가 끊겨 "59"를 "9"로 읽었다.
   밝기로 글자 픽셀을 고르고, 노란색인지는 덩어리 전체로 본다 */
export const BUFF_GLYPHS={
  '0':['.####. ##..## #....# #....# #....# #....# #....# ##..## .####.'],
  '1':['..## #### ...# ...# ...# ...# ...# ...# ...#','..## #### ..## ..## ..## ..## ...# ...# ...#','..## #### ...# ..## ..## ...# ...# ...# ...#','..## #### ..## ..## ..## ..## ..## ..## ...#'],
  '2':['##### ....# ....# ....# ...## ..##. .##.. ##... #####','#####. ....#. ....#. ....#. ...##. ..##.. .##... ##.... ######'],
  '3':['##### ...## ....# ...## .###. ...## ....# ...## ####.','##### ...## ....# ...## ####. ...## ....# ...## ####.'],
  '4':['...##. ...##. ..###. .##.#. .#..#. ##.##. ###### ....#. ....#.','...##. ...##. ..###. ..#.#. .#..#. ##.##. ###### ....#. ....#.'],
  '5':['##### #.... #.... ##... ##### ...## ....# ...## ####.','##### #.... #.... ##... ####. ...## ....# ...## ####.'],
  '6':['.##### ##.... #..... #..... #####. ##..## #....# ##..## .####.','.##### ##.... #..... #..... #####. #...## #....# ##..## .####.','.##### ##.... #..... #..... ###### #...## #....# ##..## .####.'],
  '7':['###### ....## ....#. ...##. ...#.. ..##.. ..#... .##... .##...','###### ....## ....#. ...##. ...#.. ..##.. ..#... ..#... .#....'],
  '8':['.####. ##..## #....# ##..## .####. ##..## #....# ##..## .####.'],
  '9':['.####. ##..## #....# ##..## ###### .....# .....# ....## #####.','.####. ##..## #....# ##..## .##### .....# .....# ....## #####.'],
};
// 비교 격자와 받아들일 최대 거리(칸마다 덮인 비율 차의 합). 실제 화면 글자(스크린샷·화면 공유)를 1·1.25·1.5배로 늘려 재면
// 맞게 읽은 글자는 대부분 11 이하, 숫자가 아닌 모양(꽉 찬 덩어리, H)은 가장 가까운 숫자와도 18이었다(2026-11-12)
const BG_W=6, BG_H=9, BG_MAX_DIST=12;
// 글자 픽셀의 밝기 하한. 글자 획은 밝은 픽셀(약 210)과 어두운 반쪽(약 120~150)으로, 그 옆 번짐은 약 90~110이다(2026-11-12 실제 화면)
const BUFF_LUMA=125;
const isBuffTint=(r,g,b)=>r-b>=40&&g<=r+10&&r-g<=45;   // 노란빛(흰색·보라·초록·주황이 아님)
const BUFF_YELLOW_SHARE=0.4;                             // 숫자 덩어리는 픽셀의 이만큼 이상이 노란빛(가장자리는 색이 바랜다)
const BUFF_CENTER_TOL=0.09;   // 숫자 묶음 가운데가 아이콘 가운데에서 벗어나도 되는 폭 비율. 맞게 읽은 실제 표본은 최대 0.042, 두 자리 중 하나를 놓치면 약 0.12
// w×h 글자(get(x,y)가 켜짐)를 BG_W×BG_H 격자로: 칸마다 글자 픽셀이 덮은 비율(배율이 1.25처럼 고르지 않아도 모양이 덜 흔들린다)
function glyphGrid(get,w,h){ const o=new Float32Array(BG_W*BG_H);
  for(let gy=0;gy<BG_H;gy++) for(let gx=0;gx<BG_W;gx++){ const x0=gx*w/BG_W, x1=(gx+1)*w/BG_W, y0=gy*h/BG_H, y1=(gy+1)*h/BG_H; let s=0;
    for(let y=Math.floor(y0);y<Math.ceil(y1);y++) for(let x=Math.floor(x0);x<Math.ceil(x1);x++){ const ox=Math.min(x+1,x1)-Math.max(x,x0), oy=Math.min(y+1,y1)-Math.max(y,y0); if(ox>0&&oy>0&&get(x,y)) s+=ox*oy; }
    o[gy*BG_W+gx]=s/((x1-x0)*(y1-y0)); }
  return o; }
const BUFF_GRIDS=Object.entries(BUFF_GLYPHS).flatMap(([ch,list])=>list.map(s=>{ const rows=s.split(' '); return {ch,g:glyphGrid((x,y)=>rows[y][x]==='#',rows[0].length,rows.length)}; }));
// 아이콘 상자(RGBA, W×H)에서 남은 시간을 읽어 {value(초), text} 반환. 큰 노란 숫자가 없거나 못 읽으면 null
export function ocrBuffTimer(rgba,W,H){
  const on=new Uint8Array(W*H), tint=new Uint8Array(W*H), lab=new Int32Array(W*H).fill(-1), comps=[];
  for(let i=0,j=0;i<W*H;i++,j+=4){ const r=rgba[j], g=rgba[j+1], b=rgba[j+2]; on[i]=0.299*r+0.587*g+0.114*b>=BUFF_LUMA?1:0; tint[i]=isBuffTint(r,g,b)?1:0; }
  for(let i=0;i<W*H;i++){ if(!on[i]||lab[i]>=0) continue;                       // 8-연결 덩어리
    const c={l:W,r:-1,t:H,b:-1,px:[],ty:0}, st=[i]; lab[i]=comps.length;
    while(st.length){ const k=st.pop(), x=k%W, y=(k-x)/W; c.px.push(k); c.ty+=tint[k]; if(x<c.l)c.l=x; if(x>c.r)c.r=x; if(y<c.t)c.t=y; if(y>c.b)c.b=y;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=W||ny>=H) continue; const n=ny*W+nx; if(on[n]&&lab[n]<0){ lab[n]=comps.length; st.push(n); } } }
    c.w=c.r-c.l+1; c.h=c.b-c.t+1; c.yellow=c.ty/c.px.length>=BUFF_YELLOW_SHARE; comps.push(c); }
  // 숫자 후보: 노란 덩어리 중 아이콘 높이의 0.18~0.45, 세로로 긴 것. 한 값의 숫자들은 위·아래 끝이 같다 → 가장 많이 줄 맞는 묶음(같으면 아이콘 가운데에 가까운 쪽)
  const cand=comps.filter(c=>c.yellow&&c.h>=Math.max(5,0.18*H)&&c.h<=0.45*H&&c.w<=c.h);
  let digits=null;
  for(const a of cand){ const g=cand.filter(c=>Math.abs(c.t-a.t)<=1&&Math.abs(c.b-a.b)<=1);
    const off=Math.abs((a.t+a.b)/2-H/2);
    if(!digits||g.length>digits.g.length||(g.length===digits.g.length&&off<digits.off)) digits={g,off}; }
  if(!digits) return null;
  const ds=digits.g.sort((p,q)=>p.l-q.l), hd=Math.max(...ds.map(c=>c.h)), top=Math.min(...ds.map(c=>c.t)), bot=Math.max(...ds.map(c=>c.b));
  const tokens=[];
  for(const c of ds){
    const set=new Set(c.px), g=glyphGrid((x,y)=>set.has((c.t+y)*W+c.l+x),c.w,c.h);
    let best=null; for(const t of BUFF_GRIDS){ let d=0; for(let i=0;i<g.length;i++) d+=Math.abs(g[i]-t.g[i]); if(!best||d<best.d) best={d,ch:t.ch}; }
    if(best.d>BG_MAX_DIST) return null;                                          // 숫자가 아닌 모양
    tokens.push({x:c.l,ch:best.ch});
  }
  // 콜론: 숫자 사이, 숫자 높이 안에서 위아래로 겹친 작은 점 두 개. 숫자 바로 위의 아이콘 장식 점은 숫자 높이 밖이라 뺀다(2026-11-11 초록 아이콘).
  // 점이 작아 화면 공유에서는 색이 거의 다 바래므로 색은 보지 않는다
  const dots=comps.filter(c=>c.h<=0.4*hd&&c.w<=0.4*hd&&c.t>=top&&c.b<=bot&&c.l>ds[0].r&&c.r<ds[ds.length-1].l), used=new Set(ds);
  for(const a of dots){
    if(dots.some(b=>b.b<a.t&&Math.abs(b.l-a.l)<=1)) used.add(a);                 // 아래 점
    if(!dots.some(b=>b.t>a.b&&Math.abs(b.l-a.l)<=1)) continue;                   // 위 점
    used.add(a); if(!tokens.some(t=>t.ch===':'&&Math.abs(t.x-a.l)<=1)) tokens.push({x:a.l,ch:':'});
  }
  // 숫자 일부만 읽은 경우는 버린다(2026-11-12 실제 화면: "59"의 5가 끊겨 "9"만, "52"를 "5"로 읽어 남은 시간을 틀리게 받아들임).
  // ① 숫자 띠 안에 숫자·콜론으로 설명되지 않는 숫자 크기의 노란 조각이 남았거나 ② 묶음이 아이콘 가운데에서 치우쳤으면 null
  if(comps.some(c=>!used.has(c)&&c.yellow&&c.px.length>=5&&c.h>=0.3*hd&&c.w<=hd&&c.h<=hd+1&&c.t>=top-1&&c.b<=bot+1&&c.r>=ds[0].l-0.6*hd&&c.l<=ds[ds.length-1].r+0.6*hd)) return null;
  if(Math.abs((ds[0].l+ds[ds.length-1].r+1)/2-W/2)>BUFF_CENTER_TOL*W) return null;
  const text=tokens.sort((p,q)=>p.x-q.x).map(t=>t.ch).join('');
  let m=/^(\d{1,2}):([0-5]\d)$/.exec(text); if(m) return {value:+m[1]*60+(+m[2]),text};
  m=/^\d{1,2}$/.exec(text); if(m&&+text<60) return {value:+text,text};      // 메이플은 60초 이상을 분:초로 쓴다
  return null;
}
// 읽은 숫자로 남은 시간 갱신. 잘못 읽은 값 하나로 알림이 울리지 않도록, 예상값과 맞거나 두 번 연속 일치할 때만 받아들임
export const UNREAD_MS=20000;   // 켜져 있는데 이만큼 숫자를 못 읽으면 미리 알림을 못 하므로 한 번 알림
export function stepCountdown(st, cfg, value, now){
  const ev=[];
  if(!st.present){ st.remain=null; st.cand=null; st.lastReadAt=null; st.ocrWarned=false; return ev; }
  if(st.lastReadAt==null) st.lastReadAt=st.presentAt ?? now;
  if(value==null){
    // 글자가 가려진 동안(st.held)은 못 읽는 이유를 알고 읽어 둔 시간으로 세고 있으므로 “못 읽음”을 울리지 않는다(2026-11-10 사용자 결정)
    if(!st.held && !st.ocrWarned && now-st.lastReadAt>=UNREAD_MS){ st.ocrWarned=true; ev.push('unread'); }
    // 못 읽는 동안에도 읽어 둔 남은 시간으로 미리 알림(퀘스트 진행 글자가 10초 전 순간을 가려도 울리도록)
    if(st.remain!=null && !st.alertedPre){
      const est=st.remain-(now-st.remainAt)/1000;
      if(est<=cfg.leadSec && est>0){ st.alertedPre=true; st.preMarkRemain=est; ev.push('pre'); }
    }
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
