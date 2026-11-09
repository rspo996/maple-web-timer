/* 감지용 작업 캔버스 하나를 모든 감지가 돌려 쓴다. 처음 쓸 때 만든다(import만으로는 DOM을 건드리지 않음) */
let c=null;
export function scratch(){
  if(!c){ const work=document.createElement('canvas'); c={work,wctx:work.getContext('2d',{willReadFrequently:true})}; }
  return c;
}
