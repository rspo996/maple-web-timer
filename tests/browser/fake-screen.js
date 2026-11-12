// 브라우저 검사용 가짜 화면 공유. prelude.mjs의 open()이 주입한다. 주입 뒤 "게임 화면 연결"을 누르면 이 캔버스가 공유 화면이 된다.
(() => {
  if (window.__fake) return;
  const realNow = Date.now.bind(Date); let skew = 0;
  Date.now = () => realNow() + skew;                       // 시간을 앞당겨 타이머를 시험
  const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720;
  const g = cv.getContext('2d');
  const icons = new Map();                                 // name -> {x,y,w,h,seed|img,on}
  const cells = seed => { let s = seed * 9301 + 49297; const a = []; for (let i = 0; i < 16; i++) { s = (s * 9301 + 49297) % 233280; a.push(s / 233280); } return a; };
  let black = false;
  // 버프 아이콘 가운데의 남은 시간 숫자(검은 테두리의 노란 픽셀 글꼴). 글자 모양은 앱의 BUFF_GLYPHS(실제 화면에서 뽑음)를 쓴다.
  // 4는 실제 표본이 없어 추측한 모양으로 그린다: 앱은 이 모양을 못 읽음(null)으로 처리해야 한다
  const FOUR = ['...##', '..###', '.##.#', '##..#', '#####', '....#', '....#', '....#', '....#'];
  const timerText = s => s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s);
  function drawTimer(ic) {
    const rem = Math.ceil((ic.endAt - Date.now()) / 1000); if (rem <= 0) return;          // 끝나면 숫자 없음
    const rows = [...timerText(rem)].map(ch => ch === ':' ? [...'..##..##.'] :ch === '4' ? FOUR : BUFF_GLYPHS[ch][0].split(' '));
    const W = rows.reduce((a, r) => a + r[0].length, 0) + 2 * (rows.length - 1), x0 = Math.round(ic.x + (ic.w - W) / 2), y0 = Math.round(ic.y + (ic.h - 9) / 2);
    const lit = []; let x = x0;
    for (const r of rows) { r.forEach((row, y) => [...row].forEach((c, i) => { if (c === '#') lit.push([x + i, y0 + y]); })); x += r[0].length + 2; }
    g.fillStyle = '#000'; for (const [px, py] of lit) g.fillRect(px - 1, py - 1, 3, 3);      // 검은 테두리
    g.fillStyle = 'rgb(243,227,8)'; for (const [px, py] of lit) g.fillRect(px, py, 1, 1);
  }
  const draw = () => {
    g.fillStyle = black ? '#000' : '#26303a'; g.fillRect(0, 0, cv.width, cv.height);
    if (black) return;
    for (const ic of icons.values()) {
      if (!ic.on) continue;
      if (ic.img) { if (ic.img.complete) g.drawImage(ic.img, ic.x, ic.y, ic.w, ic.h); }
      else {
        const c = cells(ic.seed), u = ic.w / 4;
        for (let i = 0; i < 16; i++) { const v = 40 + Math.floor(c[i] * 200); g.fillStyle = `rgb(${v},${(v * 1.7) % 255 | 0},${(v * 2.3) % 255 | 0})`; g.fillRect(ic.x + (i % 4) * u, ic.y + Math.floor(i / 4) * u, u, u); }
        if (ic.shade) { g.fillStyle = `rgba(0,0,0,${ic.shade})`; g.fillRect(ic.x, ic.y, ic.w, ic.h); }
      }
      if (ic.endAt) drawTimer(ic);
    }
  };
  setInterval(draw, 150);
  const fake = {
    cv, spoken: [], beeps: 0,
    pattern(name, x, y, seed, size = 32) { icons.set(name, { x, y, w: size, h: size, seed, on: true }); },     // 무늬 아이콘(등록해서 쓰는 대상용)
    image(name, url, x, y, w, h) { const img = new Image(); img.src = url; icons.set(name, { x, y, w, h, img, on: true }); },   // 그림 아이콘(내장 아이콘용)
    patternURL(seed, size = 32) { const c = document.createElement('canvas'); c.width = c.height = size; const k = c.getContext('2d'), cl = cells(seed), u = size / 4;   // pattern()과 같은 그림의 data URL(대상에 직접 넣어 등록을 건너뜀)
      for (let i = 0; i < 16; i++) { const v = 40 + Math.floor(cl[i] * 200); k.fillStyle = `rgb(${v},${(v * 1.7) % 255 | 0},${(v * 2.3) % 255 | 0})`; k.fillRect((i % 4) * u, Math.floor(i / 4) * u, u, u); } return c.toDataURL('image/png'); },
    show(name, on = true) { const ic = icons.get(name); if (ic) ic.on = on; },
    timer(name, sec) { const ic = icons.get(name); if (ic) ic.endAt = sec == null ? 0 : Date.now() + sec * 1000; },   // 아이콘에 남은 시간 숫자를 찍기 시작(지금부터 sec초). null이면 지움
    shade(name, alpha) { const ic = icons.get(name); if (ic) ic.shade = alpha; },     // 아이콘 위에 검은 반투명(쿨타임처럼 어둡게)
    black(on = true) { black = on; },
    resize(w, h) { cv.width = w; cv.height = h; },
    skew(ms) { skew += ms; },
    reset() { fake.spoken.length = 0; fake.beeps = 0; fake.osc.length = 0; if (fake.volumes) fake.volumes.length = 0; },
    wait(ms) { return new Promise(r => setTimeout(r, ms)); },
  };
  fake.volumes = [];
  speechSynthesis.speak = u => { fake.spoken.push(u.text); fake.volumes.push(u.volume); };   // 음성 문구·음량을 기록만 한다(실제로 말하지 않음)
  const co = AudioContext.prototype.createOscillator;
  fake.osc = [];                                           // 재생된 비프를 [파형, 주파수]로 기록(알림 소리 구분 확인용)
  AudioContext.prototype.createOscillator = function () {
    fake.beeps++; const o = co.call(this), start = o.start.bind(o);
    o.start = (...a) => { fake.osc.push([o.type, Math.round(o.frequency.value)]); return start(...a); };
    return o;
  };
  navigator.mediaDevices.getDisplayMedia = async () => cv.captureStream(5);
  window.__fake = fake;
})();
