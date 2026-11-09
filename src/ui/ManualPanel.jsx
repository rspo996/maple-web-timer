// 수동 타이머 창
export function ManualPanel() {
  return (
    <section className="win" id="manual" aria-labelledby="manualTitle">
      <div className="wbar mhead">
        <h2 id="manualTitle">수동 타이머</h2>
        {' '}
        <button id="manualClearDone" type="button" hidden>끝난 것 모두 지우기</button>
      </div>
      <div className="wbody">
        <p className="sub mlead">화면을 보지 않고 직접 시작해요</p>
        <div className="row chips" id="manualPresets" role="group" aria-label="프리셋: 누르면 바로 시작" />
        <form id="manualForm" className="row">
          <input id="manualName" placeholder="이름(선택)" maxLength="20" aria-label="타이머 이름" />
          {' '}
          <input id="manualDur" placeholder="분:초" size="7" aria-label="시간(분:초)" />
          {' '}
          <button className="primary">시작</button>
          {' '}
          <button type="button" id="manualSavePreset">프리셋으로 저장</button>
          {' '}
          <label className="sw">
            미리 알림
            {' '}
            <input id="manualPre" type="number" min="0" max="120" aria-describedby="manualPreSfx" />
            {' '}
            <span id="manualPreSfx" className="sub">초 전 (0=끔)</span>
          </label>
        </form>
        <details id="manualRoutineBox">
          <summary>사냥·회수 반복 만들기</summary>
          <form id="manualRoutine" className="grid">
            <label htmlFor="manualN1">구간 1</label>
            <span>
              <input id="manualN1" name="n1" defaultValue="사냥" maxLength="20" />
              {' '}
              <input name="d1" placeholder="분:초" size="7" aria-label="구간 1 길이(분:초)" />
            </span>
            {' '}
            <label htmlFor="manualN2">구간 2</label>
            <span>
              <input id="manualN2" name="n2" defaultValue="회수" maxLength="20" />
              {' '}
              <input name="d2" placeholder="분:초" size="7" aria-label="구간 2 길이(분:초)" />
            </span>
            {' '}
            <span />
            <span>
              <button className="primary">시작</button>
              {' '}
              <span className="sub">멈출 때까지 번갈아 반복해요</span>
            </span>
          </form>
        </details>
        <details id="manualPresetEdit">
          <summary>프리셋 편집</summary>
          <div id="manualPresetList" />
        </details>
        <p id="manualNote" className="sub" role="status" />
        <div id="manualList" />
      </div>
    </section>
  );
}
