// 설정 백업(내보내기·불러오기). 엔진은 app/backup.js
import { useRef } from 'react';
import { useBus } from './useBus.js';
import { bump } from '../app/bus.js';
import { backupMsg, canImport, exportBackup, exportOpts, exportSoundsLabel, importBackupFile } from '../app/backup.js';

export function Backup() {
  useBus();
  const fileRef = useRef(null);
  return (
    <details id="backupDetails" className="win">
      <summary className="wbar">
        설정 백업
        {' '}
        <span className="bar-sub">파일로 내보내기·불러오기</span>
      </summary>
      <div className="wbody">
        <div className="row">
          <button id="btnExport" type="button" onClick={() => exportBackup(exportOpts.withSounds)}>설정 내보내기</button>
          {' '}
          <label className="sw">
            <input id="exportSounds" type="checkbox" checked={exportOpts.withSounds} onChange={e => { exportOpts.withSounds = e.target.checked; bump(); }} />
            {' '}
            <span id="exportSoundsLabel">{exportSoundsLabel()}</span>
          </label>
        </div>
        <p className="sub">파일은 이 컴퓨터에만 저장돼요. 등록한 아이콘 이미지(게임 화면 일부)가 들어 있으니, 남에게 줄 때는 조심해 주세요.</p>
        <div className="row">
          <button id="btnImport" type="button" onClick={() => { if (canImport()) fileRef.current.click(); }}>설정 불러오기</button>
          <input id="fileBackup" ref={fileRef} type="file" accept=".json,application/json" hidden
            onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) importBackupFile(f); }} />
        </div>
        <p id="backupNote" className={'sub' + (backupMsg.warn ? ' warn' : '')} role="status">{backupMsg.text}</p>
      </div>
    </details>
  );
}
