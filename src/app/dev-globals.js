/* 개발 서버(npm run dev·dev:test)에서만: 모듈의 export를 window에서 읽을 수 있게 연다.
   tests/browser/*.mjs가 page.evaluate 안에서 store·states·Alerts 같은 이름을 그대로 쓴다. 읽기 전용(getter)이고 빌드에는 들어가지 않는다 */
if(import.meta.env.DEV){
  const mods=import.meta.glob(['./*.js','!./boot.js','!./dev-globals.js','../core/*.js'],{eager:true});
  for(const m of Object.values(mods)) for(const k of Object.keys(m)){
    // 진짜 브라우저 전역(window의 자기 속성)만 피한다. id로 생기는 이름(예: #manual)은 예전 전역 let처럼 가린다
    if(Object.getOwnPropertyDescriptor(window,k)){ console.warn('dev-globals: 브라우저 전역과 이름이 겹쳐 건너뜀', k); continue; }
    Object.defineProperty(window,k,{get:()=>m[k],configurable:true});
  }
}
