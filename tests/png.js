// 시험용 PNG 풀기(8비트, 인터레이스 없음, 회색·RGB·RGBA·팔레트). 내장 아이콘(data URL)을 node에서 읽으려고 쓴다
// 팔레트(colorType 3)는 2026-11-25에 더했다: 내장 룬 아이콘이 팔레트 PNG라 예전에는 모든 픽셀을 검정으로 읽었다
import zlib from 'node:zlib';
export function decodePng(src) {
  const b = Buffer.isBuffer(src) ? src : Buffer.from(String(src).split(',').pop(), 'base64');
  let p = 8, W = 0, H = 0, ct = 0, plte = null, trns = null; const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { W = d.readUInt32BE(0); H = d.readUInt32BE(4); ct = d[9]; if (d[8] !== 8 || d[12]) throw new Error('지원하지 않는 PNG'); }
    if (type === 'PLTE') plte = d;
    if (type === 'tRNS') trns = d;
    if (type === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  const bpp = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
  if (!bpp || (ct === 3 && !plte)) throw new Error('지원하지 않는 PNG 색 형식 ' + ct);
  const st = W * bpp, raw = zlib.inflateSync(Buffer.concat(idat)), px = new Uint8ClampedArray(W * H * 4);
  let prev = new Uint8Array(st);
  for (let y = 0; y < H; y++) {
    const f = raw[y * (st + 1)], line = new Uint8Array(raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)));
    for (let x = 0; x < st; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, u = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      if (f === 1) line[x] += a; else if (f === 2) line[x] += u; else if (f === 3) line[x] += (a + u) >> 1;
      else if (f === 4) { const q = a + u - c, pa = Math.abs(q - a), pb = Math.abs(q - u), pc = Math.abs(q - c); line[x] += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
    }
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, s = x * bpp;
      if (ct === 3) { const k = line[s]; px[i] = plte[k * 3]; px[i + 1] = plte[k * 3 + 1]; px[i + 2] = plte[k * 3 + 2]; px[i + 3] = trns && k < trns.length ? trns[k] : 255; }
      else if (bpp >= 3) { px[i] = line[s]; px[i + 1] = line[s + 1]; px[i + 2] = line[s + 2]; px[i + 3] = bpp === 4 ? line[s + 3] : 255; }
      else { px[i] = px[i + 1] = px[i + 2] = line[s]; px[i + 3] = bpp === 2 ? line[s + 1] : 255; }
    }
    prev = line;
  }
  return { W, H, px };
}
