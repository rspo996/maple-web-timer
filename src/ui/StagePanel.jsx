// 게임 화면 미리보기와 등록 안내줄. 캔버스 그리기와 드래그 등록은 app/register.js가 한다
import { useBus } from './useBus.js';
import { emptyText, src } from '../app/capture.js';
import { bannerText, cancelRegister, dragEnd, dragMove, dragStart, retakeSnapshot, setPreviewCanvas } from '../app/register.js';

export function StagePanel() {
  useBus();
  const banner = bannerText();
  return (
    <section className="win" id="stagePanel" aria-labelledby="stageTitle">
      <h2 className="wbar" id="stageTitle">게임 화면</h2>
      <div className="wbody">
        {/* 등록 중에만 보인다(on). 이때 게임 화면 칸이 넓어진다 */}
        <div id="banner" className={banner == null ? '' : 'on'}>
          <span id="bannerText">{banner}</span>
          <span className="row"><button id="btnRetake" type="button" onClick={retakeSnapshot}>화면 다시 찍기</button><button id="btnCancel" type="button" onClick={cancelRegister}>취소</button></span>
        </div>
        <div id="stage">
          {/* 캔버스 크기는 화면 크기에 맞춰 엔진이 바꾼다. React는 처음 크기만 정한다 */}
          <canvas id="preview" width="960" height="540" ref={setPreviewCanvas} onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={dragEnd} />
          <div id="empty" style={src ? { display: 'none' } : undefined}>{emptyText()}</div>
        </div>
      </div>
    </section>
  );
}
