// 브라우저용 클래식 스크립트를 하나의 전역(vm 컨텍스트)에 차례로 올려 시험한다. 브라우저와 같이 파일끼리 전역 이름으로 서로를 본다.
// - 함수 선언은 반환값의 속성으로 바로 읽힌다. 최상위 const/let 값은 ctx.get('KINDS')처럼 읽는다.
// - vm 안에서 만든 객체는 프로토타입이 달라 deepStrictEqual이 실패하므로 ctx.plain(x)로 JSON 복사본을 만들어 비교한다.
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
function load(files, globals = {}) {
  const ctx = vm.createContext({ console, ...globals });
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
  ctx.get = name => vm.runInContext(name, ctx);
  ctx.plain = x => JSON.parse(JSON.stringify(x));
  return ctx;
}
module.exports = { load };
