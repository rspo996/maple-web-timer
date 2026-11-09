// 여러 화면이 같이 쓰는 작은 부품
import { useEffect, useLayoutEffect, useRef } from 'react';

// 남은 시간 게이지(카드·수동 타이머 공통). g={frac,low} 또는 null(숨김)
export function Gauge({ g }) {
  return (
    <div className={'gauge' + (g && g.low ? ' low' : '')} data-s="gauge" aria-hidden="true" hidden={!g}
      style={g ? { '--f': g.frac.toFixed(3) } : undefined}><i /></div>
  );
}

// 입력을 마쳤을 때(브라우저의 change 이벤트: Enter·포커스 이동·스피너)만 onCommit(input)을 부르는 입력 칸.
// React의 onChange는 글자마다 불려서, 입력 중에 값을 고쳐 쓰는 칸(범위 자르기·분:초 정리)에는 맞지 않는다.
// value는 엔진에 저장된 값: 처음과 그 값이 바뀔 때 칸에 쓴다. 입력을 되돌릴 때(값이 그대로)는 onCommit이 input.value를 직접 고친다
export function CommitInput({ onCommit, value, ...props }) {
  const ref = useRef(null), fn = useRef(onCommit);
  fn.current = onCommit;
  useEffect(() => {
    const el = ref.current, h = () => fn.current(el);
    el.addEventListener('change', h); return () => el.removeEventListener('change', h);
  }, []);
  useLayoutEffect(() => { ref.current.value = value ?? ''; }, [value]);
  return <input ref={ref} {...props} />;
}
