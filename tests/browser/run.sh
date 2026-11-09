#!/bin/sh
# 브라우저 시나리오를 차례로 돌린다. 먼저 다른 터미널에서 `npm run dev:test`(127.0.0.1:8766)를 띄워 둔다.
# 사용: sh tests/browser/run.sh [시나리오 이름...]   예: sh tests/browser/run.sh targets-ui pip
ROOT=${ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}
cd "$ROOT/tests/browser" || exit 1
NAMES=${*:-$(ls *.mjs | grep -v '^prelude' | sed 's/\.mjs$//')}
fail=0
for n in $NAMES; do
  out=$(sed "s#__ROOT__#$ROOT#g" "$n.mjs" | ego-browser nodejs 2>&1)
  res=$(printf '%s\n' "$out" | grep '^RESULT' | tail -1)
  printf '%-14s %s\n' "$n" "${res:-RESULT 없음(스크립트 오류)}"
  printf '%s\n' "$out" | grep -E '^FAIL|Error' | head -5 | sed 's/^/    /'
  case "$res" in *" 0 failed") ;; *) fail=1 ;; esac
done
exit $fail
