/* ===== 핵심 계산: 정규화 상호상관(NCC) 템플릿 매칭 ===== */
export function toGray(rgba, n){
  const g = new Float32Array(n);
  for(let i=0,j=0;i<n;i++,j+=4) g[i] = 0.299*rgba[j] + 0.587*rgba[j+1] + 0.114*rgba[j+2];
  return g;
}
// mask: 비교에 쓸 픽셀(Uint8Array w*h, 1=씀). 생략하면 모든 픽셀.
// 버프 아이콘 가운데의 남은 시간 숫자처럼 매번 바뀌는 부분이나, 룬 마름모 바깥의 맵 배경처럼 상관없는 부분을 빼고 비교할 때 쓴다
export function prepTemplate(gray, w, h, mask){
  const rects=maskRects(mask,w,h); let n=0, s=0;
  for(const [y0,y1,x0,x1] of rects) for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){ s+=gray[y*w+x]; n++; }
  const m=s/n, t=new Float32Array(w*h); let ss=0;          // 뺀 픽셀은 0으로 남는다(비교에 쓰지 않음)
  for(const [y0,y1,x0,x1] of rects) for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){ const i=y*w+x; t[i]=gray[i]-m; ss+=t[i]*t[i]; }
  return {t, w, h, n, rects, norm:Math.sqrt(ss)};
}
// 마스크를 사각형 [y0, y1, x0, x1) 목록으로. 행마다 이어진 구간을 찾고, 바로 위 행과 구간이 같으면 사각형을 아래로 늘린다
export function maskRects(mask, w, h){
  if(!mask) return [[0,h,0,w]];
  const out=[]; let open=[];
  for(let y=0;y<h;y++){ const next=[];
    for(let x=0;x<w;){ if(!mask[y*w+x]){ x++; continue; } const x0=x; while(x<w&&mask[y*w+x]) x++;
      const r=open.find(r=>r[2]===x0&&r[3]===x); if(r){ r[1]=y+1; next.push(r); } else { const nr=[y,y+1,x0,x]; out.push(nr); next.push(nr); } }
    open=next; }
  return out;
}
// 행 중심 비율 (y+0.5)/h가 lo~hi인 가운데 띠를 뺀 마스크
export function bandMask(w, h, lo, hi){ const m=new Uint8Array(w*h); for(let y=0;y<h;y++){ const f=(y+0.5)/h; if(f<lo||f>hi) m.fill(1,y*w,y*w+w); } return m; }
// 상자에 꼭 맞는 마름모 |dx|/rx + |dy|/ry ≤ 1 (룬 미니맵 아이콘)
export function diamondMask(w, h){ const m=new Uint8Array(w*h), cx=(w-1)/2, cy=(h-1)/2, rx=Math.max(cx,0.5), ry=Math.max(cy,0.5);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(Math.abs(x-cx)/rx+Math.abs(y-cy)/ry<=1+1e-9) m[y*w+x]=1; return m; }
// 적분 배열은 매 호출마다 새로 만들지 않고 재사용(546×142 영역이면 약 1.2MB씩 만들던 것). 더 큰 크기가 필요할 때만 다시 만든다
export const matchStats={allocs:0}; export let bufS=null, bufQ=null;
export function integralBuffers(n){ if(!bufS||bufS.length<n){ bufS=new Float64Array(n); bufQ=new Float64Array(n); matchStats.allocs++; } return [bufS,bufQ]; }
// 검색 영역(img, W×H)에서 템플릿과 가장 비슷한 위치와 점수(-1~1)를 반환
export function matchTemplate(img, W, H, tpl){
  const {t,w,h,norm}=tpl, n=tpl.n??w*h, rects=tpl.rects??[[0,h,0,w]];
  if(W<w||H<h||norm<1e-3) return {score:0,x:0,y:0};
  const W1=W+1, [S,Q]=integralBuffers(W1*(H+1));
  S.fill(0,0,W1); Q.fill(0,0,W1);          // 재사용 배열이라 첫 행·첫 열의 0은 직접 채운다
  for(let y=0;y<H;y++){ let rs=0,rq=0; S[(y+1)*W1]=0; Q[(y+1)*W1]=0;
    for(let x=0;x<W;x++){ const v=img[y*W+x]; rs+=v; rq+=v*v;
      S[(y+1)*W1+x+1]=S[y*W1+x+1]+rs; Q[(y+1)*W1+x+1]=Q[y*W1+x+1]+rq; } }
  let best=-2,bx=0,by=0;
  for(let y=0;y<=H-h;y++) for(let x=0;x<=W-w;x++){
    let sum=0, sq=0;                         // 마스크 사각형마다 적분 영상으로 합(마스크가 없으면 사각형 하나 = 예전 계산)
    for(const [y0,y1,x0,x1] of rects){ const a=(y+y0)*W1+x+x0,b=a+(x1-x0),c=(y+y1)*W1+x+x0,d=c+(x1-x0); sum+=S[d]-S[b]-S[c]+S[a]; sq+=Q[d]-Q[b]-Q[c]+Q[a]; }
    const v=sq-sum*sum/n; if(v<1e-3) continue;
    let cr=0;
    for(const [y0,y1,x0,x1] of rects) for(let ty=y0;ty<y1;ty++){ const ro=(y+ty)*W+x, to=ty*w; for(let tx=x0;tx<x1;tx++) cr+=t[to+tx]*img[ro+tx]; }
    const sc=cr/(norm*Math.sqrt(v));
    if(sc>best){best=sc;bx=x;by=y;}
  }
  return {score:Math.max(best,0),x:bx,y:by};
}
