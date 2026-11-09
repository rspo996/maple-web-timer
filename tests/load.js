// 시험할 src/core 모듈들을 import해 export를 한 객체로 합친다. 예: await load(['util', 'targets', 'kinds'])
// - L.get('KINDS')와 L.plain(x)(JSON 복사본)은 예전 vm 로더 때의 시험 코드 모양을 그대로 쓰려고 둔다.
// - ES 모듈은 시험 파일 하나(한 프로세스) 안에서 공유된다. idle·cooldown을 import하면 같은 KINDS에 종류가 등록된다.
export async function load(names) {
  const out = {};
  for (const n of names) Object.assign(out, await import(new URL(`../src/core/${n}.js`, import.meta.url)));
  out.get = name => out[name];
  out.plain = x => JSON.parse(JSON.stringify(x));
  return out;
}
