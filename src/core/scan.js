/* ===== 템플릿 검색 범위 줄이기 (2026-11-14: 부스터 감지가 1920×1080에서 틱마다 약 500ms 걸려 "감지가 느려요"가 떴다) =====
   1) 한 번 찾으면 다음 틱에는 그 자리 주변만 다시 잰다(nearRect). 거기서 못 찾을 때만 넓게 찾는다
   2) 넓게 찾을 때 후보(아이콘×크기)를 틱마다 step개씩 돌아가며 본다(scanSlice). step이 없으면 예전처럼 전부 */

// 찾은 자리(pos: 화면 좌표)를 아이콘 한 칸(가로·세로 중 큰 쪽)만큼 넓혀 감지 영역(area) 안으로 자른다.
// 한 칸 여유: 버프창은 다른 버프가 생기고 사라질 때 한 칸씩 밀린다
export function nearRect(pos, area){
  const R=Math.ceil(Math.max(pos.w,pos.h));
  const x0=Math.max(area.x,Math.floor(pos.x-R)), y0=Math.max(area.y,Math.floor(pos.y-R));
  const x1=Math.min(area.x+area.w,Math.ceil(pos.x+pos.w+R)), y1=Math.min(area.y+area.h,Math.ceil(pos.y+pos.h+R));
  return x1>x0&&y1>y0?{x:x0,y:y0,w:x1-x0,h:y1-y0}:null;
}

// 후보 n개 중 이번 틱에 볼 번호(idx)와 다음 틱의 시작(next)
export function scanSlice(n, cursor, step){
  if(!step||step>=n) return {idx:[...Array(n).keys()],next:0};
  const c=((cursor%n)+n)%n;
  return {idx:Array.from({length:step},(_,i)=>(c+i)%n),next:(c+step)%n};
}

/* ----- 크기 맞추기 (2026-11-15) -----
   메이플의 UI 크기 설정에 따라 아이콘 크기가 정해진 검색 크기(1·1.25·1.5배) 사이에 걸리면 일치도가 0.5대로 떨어진다.
   실제 화면 공유 아이콘으로 재면 크기가 2% 다르면 약 0.8, 4% 다르면 0.6대. 그래서 대략 찾은 자리에서만 2% 간격으로 크기를 다시 재고,
   가장 잘 맞는 크기를 기억한다 */
// 0.7~2.0배를 2%씩(배율 비)
export const SCALE_GRID=(()=>{ const g=[]; for(let s=0.7;s<=2.0001;s*=1.02) g.push(Math.round(s*1000)/1000); return g; })();
// 시작 크기 s0의 ±span 안의 격자 크기. 검색 크기 사이 간격(25%)을 덮는다
export function sweepScales(s0, span=0.25, grid=SCALE_GRID){ return grid.filter(s=>s>=s0*(1-span)-1e-9&&s<=s0*(1+span)+1e-9); }
// measure(s) → {score,...} 또는 null(템플릿이 아직 준비 안 됨). 가장 높은 점수의 결과에 s를 붙여 돌려준다
export function pickScale(scales, measure){
  let best=null, ready=true;
  for(const s of scales){ const r=measure(s); if(r==null){ ready=false; continue; } if(!best||r.score>best.score) best={...r,s}; }
  return {best,ready};
}
// 대략 찾은 결과들({score,pos}) 중 크기 맞추기를 해 볼 후보: 점수 min 이상, 점수 높은 순, 자리가 겹치는 것(가운데 거리가 아이콘 반 칸 이내)은 하나만, 최대 n개.
// 진짜 아이콘이 크기가 안 맞아 다른 아이콘보다 조금 낮게 나와도 놓치지 않으려고 여러 개를 본다
export function proposals(results, min, n=3){
  const out=[], mid=p=>[p.x+p.w/2,p.y+p.h/2];
  for(const r of [...results].filter(r=>r&&r.score>=min).sort((a,b)=>b.score-a.score)){
    const [x,y]=mid(r.pos);
    if(out.some(o=>{ const [ox,oy]=mid(o.pos), h=Math.max(o.pos.w,o.pos.h,r.pos.w,r.pos.h)/2; return Math.abs(ox-x)<=h&&Math.abs(oy-y)<=h; })) continue;
    out.push(r); if(out.length>=n) break;
  }
  return out;
}
