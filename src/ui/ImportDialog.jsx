// 설정 불러오기 확인 창
export function ImportDialog() {
  return (
    <dialog id="importDialog" aria-labelledby="importTitle">
      <form method="dialog">
        <h3 id="importTitle">설정 불러오기</h3>
        <p id="importSummary" />
        <p id="importExtra" className="warn" hidden />
        <details id="importSkipped" hidden>
          <summary />
          <ul />
        </details>
        <fieldset>
          <legend>불러올 것</legend>
          <label className="sw">
            <input type="checkbox" name="targets" defaultChecked />
            {' '}
            감지 대상과 내 소리
          </label>
          {' '}
          <label className="sw">
            <input type="checkbox" name="manual" defaultChecked />
            {' '}
            수동 타이머
          </label>
          {' '}
          <label className="sw">
            <input type="checkbox" name="ui" defaultChecked />
            {' '}
            음량·화면 설정
          </label>
        </fieldset>
        <p>
          <a href="#" id="importExportFirst">먼저 지금 설정 내보내기</a>
        </p>
        <div className="row">
          <button type="button" className="primary" id="importOk">불러오기</button>
          <button type="button" id="importCancel">취소</button>
        </div>
      </form>
    </dialog>
  );
}
