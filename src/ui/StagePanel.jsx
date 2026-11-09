// 게임 화면 미리보기와 등록 안내줄
export function StagePanel() {
  return (
    <section className="win" id="stagePanel" aria-labelledby="stageTitle">
      <h2 className="wbar" id="stageTitle">게임 화면</h2>
      <div className="wbody">
        <div id="banner">
          <span id="bannerText" />
          <span className="row">
            <button id="btnRetake" type="button">화면 다시 찍기</button>
            <button id="btnCancel" type="button">취소</button>
          </span>
        </div>
        <div id="stage">
          <canvas id="preview" width="960" height="540" />
          <div id="empty">“게임 화면 연결”을 눌러 메이플스토리 창을 공유하세요.</div>
        </div>
      </div>
    </section>
  );
}
