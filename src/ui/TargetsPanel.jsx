// 감지 대상 목록 창
export function TargetsPanel() {
  return (
    <aside id="cards" className="win" aria-labelledby="subtitle">
      <h2 className="wbar">
        <span id="subtitle">감지 대상</span>
      </h2>
      <div className="wbody">
        <div id="addBar">
          <button id="btnAdd" type="button" aria-expanded="false" aria-controls="addMenu">+ 대상 추가</button>
          {' '}
          <span id="addNote" className="sub" role="status" />
          <div id="addMenu" hidden />
        </div>
        <div id="cardList" />
      </div>
    </aside>
  );
}
