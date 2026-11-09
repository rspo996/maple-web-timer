// 알림 소리 바꾸기와 가까운 알림 묶기
export function SoundSettings() {
  return (
    <details id="soundsDetails" className="win">
      <summary className="wbar">
        알림 소리 바꾸기
        {' '}
        <span className="bar-sub">내 WAV 파일 쓰기</span>
      </summary>
      <div className="wbody">
        <p className="sub">파일을 고르면 그 알림은 기본 경고음과 음성 대신 고른 소리로 울려요. 10초 이하, 5MB 이하 소리만 쓸 수 있고, 파일은 이 브라우저에만 저장돼요.</p>
        <fieldset id="groupCtl">
          <legend>가까운 알림 묶기</legend>
          <label className="sw">
            <input type="radio" name="grp" value="0" defaultChecked />
            {' '}
            끔
          </label>
          {' '}
          <label className="sw">
            <input type="radio" name="grp" value="5" />
            {' '}
            5초
          </label>
          {' '}
          <label className="sw">
            <input type="radio" name="grp" value="10" />
            {' '}
            10초
          </label>
          {' '}
          <label className="sw">
            <input type="radio" name="grp" value="20" />
            {' '}
            20초
          </label>
          <p className="sub">켜면 한 버프의 미리 알림이 울릴 때, 곧(선택한 시간 안에) 끝나는 다른 버프도 같이 한 번에 알려요. 묶인 알림에서는 각 버프의 내 소리 대신 아래 “묶음 알림” 소리를 써요.</p>
        </fieldset>
        <div id="soundRows" />
        <p id="soundNote" className="sub" role="status" />
      </div>
    </details>
  );
}
