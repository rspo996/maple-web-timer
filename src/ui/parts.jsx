// 여러 화면이 같이 쓰는 작은 부품
import { useEffect, useLayoutEffect, useRef } from 'react';

// 남은 시간 게이지(카드·수동 타이머 공통). g={frac,low} 또는 null(숨김)
export function Gauge({ g }) {
  return (
    <div className={'gauge' + (g && g.low ? ' low' : '')} data-s="gauge" aria-hidden="true" hidden={!g}
      style={g ? { '--f': g.frac.toFixed(3) } : undefined}><i /></div>
  );
}

// 브라우저 이벤트를 요소에 직접 받는 입력 칸.
// - onCommit(input): 입력을 마쳤을 때(change: Enter·포커스 이동·스피너·슬라이더에서 손 뗌). React의 onChange는 글자마다 불려서,
//   입력 중에 값을 고쳐 쓰는 칸(범위 자르기·분:초 정리)에는 맞지 않는다
// - onInput(input): 값이 바뀌는 동안(슬라이더 드래그)
// - value·checked: 엔진에 저장된 값. 처음과 그 값이 바뀔 때 칸에 쓴다. 입력을 되돌릴 때(값이 그대로)는 onCommit이 input.value를 직접 고친다
export function NativeInput({ onCommit, onInput, value, checked, ...props }) {
  const ref = useRef(null), fn = useRef({});
  fn.current = { onCommit, onInput };
  useEffect(() => {
    const el = ref.current, c = () => fn.current.onCommit && fn.current.onCommit(el), i = () => fn.current.onInput && fn.current.onInput(el);
    el.addEventListener('change', c); el.addEventListener('input', i);
    return () => { el.removeEventListener('change', c); el.removeEventListener('input', i); };
  }, []);
  useLayoutEffect(() => { if (value !== undefined) ref.current.value = value; }, [value]);
  useLayoutEffect(() => { if (checked !== undefined) ref.current.checked = checked; }, [checked]);
  return <input ref={ref} {...props} />;
}
