// 설정 백업(내보내기·불러오기)
export function Backup() {
  return (
    <details id="backupDetails" className="win">
      <summary className="wbar">
        설정 백업
        {' '}
        <span className="bar-sub">파일로 내보내기·불러오기</span>
      </summary>
      <div className="wbody">
        <div className="row">
          <button id="btnExport" type="button">설정 내보내기</button>
          {' '}
          <label className="sw">
            <input id="exportSounds" type="checkbox" defaultChecked />
            {' '}
            <span id="exportSoundsLabel">내 소리 파일 포함</span>
          </label>
        </div>
        <p className="sub">파일은 이 컴퓨터에만 저장돼요. 등록한 아이콘 이미지(게임 화면 일부)가 들어 있으니, 남에게 줄 때는 조심해 주세요.</p>
        <div className="row">
          <button id="btnImport" type="button">설정 불러오기</button>
          <input id="fileBackup" type="file" accept=".json,application/json" hidden />
        </div>
        <p id="backupNote" className="sub" role="status" />
      </div>
    </details>
  );
}
