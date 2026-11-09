// 설정 불러오기 확인 창. 엔진이 내용을 채우고(importView) seq가 바뀌면 모달로 연다
import { useLayoutEffect, useRef } from 'react';
import { useBus } from './useBus.js';
import { cancelImport, confirmImport, exportBackup, exportOpts, importView } from '../app/backup.js';

const PICKS = [['targets', '감지 대상과 내 소리'], ['manual', '수동 타이머'], ['ui', '음량·화면 설정']];

export function ImportDialog() {
  useBus();
  const ref = useRef(null), v = importView;
  useLayoutEffect(() => {
    const d = ref.current;
    if (v.open && !d.open) { d.returnValue = ''; d.showModal(); }
  }, [v.seq, v.open]);
  const ok = () => {
    const f = ref.current.querySelector('form').elements, sel = { targets: f.targets.checked, manual: f.manual.checked, ui: f.ui.checked };
    ref.current.close('ok'); confirmImport(sel);
  };
  const cancel = () => { ref.current.close('cancel'); cancelImport(); };
  return (
    <dialog id="importDialog" ref={ref} aria-labelledby="importTitle" onCancel={cancelImport}>
      <form method="dialog">
        <h3 id="importTitle">설정 불러오기</h3>
        <p id="importSummary">{v.summary}</p>
        <p id="importExtra" className="warn" hidden={!v.extra}>{v.extra}</p>
        <details id="importSkipped" hidden={!v.warnings.length}>
          <summary>{v.seq ? `일부 항목(${v.warnings.length}개)은 건너뛰어요` : ''}</summary>
          <ul>{v.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </details>
        {/* 창을 열 때마다(seq) 파일에 있는 묶음만 고를 수 있게 새로 채운다 */}
        <fieldset key={v.seq}>
          <legend>불러올 것</legend>
          {PICKS.map(([name, label]) => (
            <label key={name} className="sw">
              <input type="checkbox" name={name} defaultChecked={v.has[name]} disabled={!v.has[name]} />
              {' '}
              {label}
            </label>
          )).flatMap((el, i) => i ? [' ', el] : [el])}
        </fieldset>
        <p>
          <a href="#" id="importExportFirst" onClick={e => { e.preventDefault(); exportBackup(exportOpts.withSounds); }}>먼저 지금 설정 내보내기</a>
        </p>
        <div className="row">
          <button type="button" className="primary" id="importOk" onClick={ok}>불러오기</button>
          <button type="button" id="importCancel" onClick={cancel}>취소</button>
        </div>
      </form>
    </dialog>
  );
}
