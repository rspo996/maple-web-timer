// 헤더: 이름과 연결·테스트·알림·작은 창·음량 도구
export function Masthead() {
  return (
    <header className="masthead">
      <div className="brand">
        <svg className="crest" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
          <rect x="1.5" y="1.5" width="37" height="37" rx="4" className="crest-slot" />
          <path className="crest-bell" d="M20 7.5c-1.3 0-2.2 1-2.2 2.1v.9c-4.3 1.1-7 4.8-7 9.4v5.4l-2.6 3.1c-.6.7-.1 1.8.8 1.8h22c.9 0 1.4-1.1.8-1.8l-2.6-3.1v-5.4c0-4.6-2.7-8.3-7-9.4v-.9c0-1.1-.9-2.1-2.2-2.1z" />
          <path className="crest-shine" d="M15.2 15.6c.9-1.9 2.4-3.1 4-3.5" />
          <circle className="crest-clapper" cx="20" cy="33" r="2.6" />
        </svg>
        <h1>메이플 재획 알리미</h1>
      </div>
      <div className="tools">
        <button id="btnConnect" type="button" className="primary">게임 화면 연결</button>
        {' '}
        <button id="btnImage" type="button">스크린샷으로 테스트</button>
        {' '}
        <input id="fileImage" type="file" accept="image/*" hidden />
        {' '}
        <button id="btnNotify" type="button">브라우저 알림 허용</button>
        {' '}
        <button id="btnPip" type="button">작은 창 열기</button>
        {' '}
        <span id="pipNote" className="sub" hidden>이 브라우저는 작은 창을 지원하지 않아요</span>
        <div className="soundbox">
          <label className="sw">
            음량
            {' '}
            <input id="vol" type="range" min="0" max="200" step="5" defaultValue="80" list="volTicks" aria-describedby="volNote" />
            {' '}
            <b id="volPct" className="vol-pct">80%</b>
          </label>
          <datalist id="volTicks">
            <option value="100" />
          </datalist>
          <label className="sw">
            <input id="voice" type="checkbox" defaultChecked />
            {' '}
            음성
          </label>
        </div>
        <span id="volNote" className="sub" hidden>음성은 100%까지만 커져요. 소리가 갈라지면 줄여 주세요</span>
      </div>
    </header>
  );
}
