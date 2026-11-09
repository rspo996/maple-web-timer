// 틱이 느려졌는지 지켜본다(스펙 9.3 ①): 지수 이동 평균이 limitMs를 needTicks번 연속 넘으면 그때의 평균(ms)을 한 번 돌려주고, 회복하면 다시 알릴 수 있다
export function createSlowWatch(limitMs,needTicks){
  let ema=null, over=0, warned=false;
  return { push(ms){
    ema=ema==null?ms:ema*0.8+ms*0.2;
    if(ema>limitMs) over++; else { over=0; warned=false; }
    if(over>=needTicks&&!warned){ warned=true; return Math.round(ema); }
    return null;
  } };
}
