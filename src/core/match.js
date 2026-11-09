/* ===== 핵심 계산: 정규화 상호상관(NCC) 템플릿 매칭 ===== */
export function toGray(rgba, n){
  const g = new Float32Array(n);
  for(let i=0,j=0;i<n;i++,j+=4) g[i] = 0.299*rgba[j] + 0.587*rgba[j+1] + 0.114*rgba[j+2];
  return g;
}
export function prepTemplate(gray, w, h){
  const n=w*h; let s=0; for(let i=0;i<n;i++) s+=gray[i];
  const m=s/n, t=new Float32Array(n); let ss=0;
  for(let i=0;i<n;i++){ t[i]=gray[i]-m; ss+=t[i]*t[i]; }
  return {t, w, h, norm:Math.sqrt(ss)};
}
// 적분 배열은 매 호출마다 새로 만들지 않고 재사용(546×142 영역이면 약 1.2MB씩 만들던 것). 더 큰 크기가 필요할 때만 다시 만든다
export const matchStats={allocs:0}; export let bufS=null, bufQ=null;
export function integralBuffers(n){ if(!bufS||bufS.length<n){ bufS=new Float64Array(n); bufQ=new Float64Array(n); matchStats.allocs++; } return [bufS,bufQ]; }
// 검색 영역(img, W×H)에서 템플릿과 가장 비슷한 위치와 점수(-1~1)를 반환
export function matchTemplate(img, W, H, tpl){
  const {t,w,h,norm}=tpl;
  if(W<w||H<h||norm<1e-3) return {score:0,x:0,y:0};
  const W1=W+1, [S,Q]=integralBuffers(W1*(H+1));
  S.fill(0,0,W1); Q.fill(0,0,W1);          // 재사용 배열이라 첫 행·첫 열의 0은 직접 채운다
  for(let y=0;y<H;y++){ let rs=0,rq=0; S[(y+1)*W1]=0; Q[(y+1)*W1]=0;
    for(let x=0;x<W;x++){ const v=img[y*W+x]; rs+=v; rq+=v*v;
      S[(y+1)*W1+x+1]=S[y*W1+x+1]+rs; Q[(y+1)*W1+x+1]=Q[y*W1+x+1]+rq; } }
  const n=w*h; let best=-2,bx=0,by=0;
  for(let y=0;y<=H-h;y++) for(let x=0;x<=W-w;x++){
    const a=y*W1+x,b=a+w,c=(y+h)*W1+x,d=c+w;
    const sum=S[d]-S[b]-S[c]+S[a], sq=Q[d]-Q[b]-Q[c]+Q[a];
    const v=sq-sum*sum/n; if(v<1e-3) continue;
    let cr=0;
    for(let ty=0;ty<h;ty++){ const ro=(y+ty)*W+x, to=ty*w; for(let tx=0;tx<w;tx++) cr+=t[to+tx]*img[ro+tx]; }
    const sc=cr/(norm*Math.sqrt(v));
    if(sc>best){best=sc;bx=x;by=y;}
  }
  return {score:Math.max(best,0),x:bx,y:by};
}
