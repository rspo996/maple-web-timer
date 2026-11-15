// 시험용: 앱의 detectTemplate(src/app/detect-run.js)을 node에서 흉내 낸다. 브라우저 canvas 대신 회색조 배열로 줄이고 늘린다.
// 대략 찾기(검색 크기마다 축소 검색 → 원본 크기로 다시 재기) → 후보 몇 곳(proposals) → 그 자리에서 크기 맞추기(sweepScales)
import { toGray, prepTemplate, matchTemplate, matchTemplateTop, bandMask } from '../src/core/match.js';
import { nearRect, proposals, sweepScales, pickScale } from '../src/core/scan.js';
import { decodePng } from './png.js';

// k<1이면 면적 평균, k>=1이면 양선형(브라우저 drawImage의 부드러운 확대·축소 흉내)
export function resize(g, W, H, k) {
  const w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k)), o = new Float32Array(w * h);
  if (k < 1) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ax = x * W / w, bx = (x + 1) * W / w, ay = y * H / h, by = (y + 1) * H / h; let s = 0, n = 0;
      for (let yy = Math.floor(ay); yy < Math.ceil(by); yy++) for (let xx = Math.floor(ax); xx < Math.ceil(bx); xx++) {
        const wt = (Math.min(bx, xx + 1) - Math.max(ax, xx)) * (Math.min(by, yy + 1) - Math.max(ay, yy)); if (wt > 0) { s += g[yy * W + xx] * wt; n += wt; }
      }
      o[y * w + x] = s / n;
    }
    return { g: o, w, h };
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(W - 1.001, Math.max(0, (x + 0.5) / k - 0.5)), sy = Math.min(H - 1.001, Math.max(0, (y + 0.5) / k - 0.5));
    const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
    o[y * w + x] = g[y0 * W + x0] * (1 - fx) * (1 - fy) + g[y0 * W + x0 + 1] * fx * (1 - fy) + g[(y0 + 1) * W + x0] * (1 - fx) * fy + g[(y0 + 1) * W + x0 + 1] * fx * fy;
  }
  return { g: o, w, h };
}
export const cut = (g, W, r) => { const o = new Float32Array(r.w * r.h); for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) o[y * r.w + x] = g[(r.y + y) * W + r.x + x]; return o; };
const scaleFor = (tw, th) => Math.min(1, Math.max(0.25, 14 / Math.min(tw, th)));   // detect-run.js와 같은 값

// 아이콘({url, crop} 또는 {gray, w, h, crop})을 크기 s, 축소 k로 만든 템플릿(가장자리 crop, 숫자 띠 band를 뺌)
export function iconGray(icon) {
  if (icon.gray) return icon;
  const d = decodePng(icon.url); return { gray: toGray(d.px, d.W * d.H), w: d.W, h: d.H, crop: icon.crop || 0 };
}
function tplOf(ig, s, k, band) {
  const m = ig.crop, iw = ig.w - 2 * m, ih = ig.h - 2 * m, T = resize(cut(ig.gray, ig.w, { x: m, y: m, w: iw, h: ih }), iw, ih, s * k);
  return prepTemplate(T.g, T.w, T.h, band ? bandMask(T.w, T.h, band[0], band[1]) : undefined);
}
// 화면(gray W×H)의 사각형 r 안에서 아이콘을 크기 s로 잰다 → {score, s, pos}. okAt(pos)가 있으면 앱처럼 상위 12자리 중 그것을 통과한 가장 높은 자리
export function measureAt(img, W, H, ig, s, r, band, okAt = null) {
  const iw = (ig.w - 2 * ig.crop) * s, ih = (ig.h - 2 * ig.crop) * s, k = scaleFor(iw, ih), tp = tplOf(ig, s, k, band);
  const A = resize(cut(img, W, r), r.w, r.h, k);
  if (A.w < tp.w || A.h < tp.h) return { score: 0, s, pos: { x: r.x, y: r.y, w: ig.w * s, h: ig.h * s } };
  const one = m => {
  let x = r.x + m.x / k, y = r.y + m.y / k, score = m.score;
  if (k < 1) {   // 원본 크기로 다시 재기(refineAt)
    const full = tplOf(ig, s, 1, band), R = Math.ceil(1 / k) + 1, x0 = Math.max(0, Math.round(x) - R), y0 = Math.max(0, Math.round(y) - R);
    const rr = { x: x0, y: y0, w: Math.min(W, Math.round(x) + full.w + R) - x0, h: Math.min(H, Math.round(y) + full.h + R) - y0 };
    if (rr.w >= full.w && rr.h >= full.h) { const f = matchTemplate(cut(img, W, rr), rr.w, rr.h, full); score = f.score; x = rr.x + f.x; y = rr.y + f.y; }
  }
  const mm = ig.crop * s; return { score, s, pos: { x: x - mm, y: y - mm, w: ig.w * s, h: ig.h * s } };
  };
  if (!okAt) return one(matchTemplate(A.g, A.w, A.h, tp));
  let best = null, first = null;
  for (const m of matchTemplateTop(A.g, A.w, A.h, tp, 12)) { const o = one(m); first = first || o; if (okAt(o.pos) && (!best || o.score > best.score)) best = o; }
  return best || { ...first, score: 0 };
}
// pos 상자 안 (fx, fy) 지점 3×3 평균 색이 fill을 만족하는지(detect-run.js의 fillAt). px는 RGBA
export function fillOk(px, W, H, pos, fill, [fx, fy] = [0.5, 0.5]) {
  const x = Math.round(pos.x + pos.w * fx - 1.5), y = Math.round(pos.y + pos.h * fy - 1.5); if (x < 0 || y < 0 || x + 3 > W || y + 3 > H) return false;
  let r = 0, g = 0, b = 0; for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const k = ((y + j) * W + x + i) * 4; r += px[k]; g += px[k + 1]; b += px[k + 2]; }
  return fill(r / 9, g / 9, b / 9);
}
// 앱처럼 찾기: 검색 크기 scales로 대략 찾고, 후보 자리에서 크기를 맞춘다. preset의 fill이 있으면 색 확인(px 필요)
export function detect(img, W, H, icons, scales, band, { sweepMin = 0.4, px = null, preset = null } = {}) {
  const area = { x: 0, y: 0, w: W, h: H }, igs = icons.map(iconGray), seen = [];
  const okAt = preset && preset.fill ? pos => fillOk(px, W, H, pos, preset.fill, preset.fillAt) : null;
  const at = (ig, s, r) => measureAt(img, W, H, ig, s, r, band, okAt);
  for (const ig of igs) for (const s of scales) seen.push({ ...at(ig, s, area), ig });
  let best = seen.reduce((a, b) => (b.score > a.score ? b : a));
  for (const pr of proposals(seen, sweepMin)) {
    const r = nearRect(pr.pos, area), { best: b } = pickScale(sweepScales(pr.s), s => ({ ...at(pr.ig, s, r), ig: pr.ig }));
    if (b && b.score > best.score) best = b;
  }
  return { best, seen };
}
