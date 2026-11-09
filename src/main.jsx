import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import { setFlush } from './app/bus.js';
import { boot } from './app/boot.js';
import { App } from './ui/App.jsx';

setFlush(fn => flushSync(fn));   // 엔진이 상태를 바꾸고 bump()하면 그 자리에서 DOM까지 맞춘다
const root = createRoot(document.getElementById('root'));
flushSync(() => root.render(<StrictMode><App /></StrictMode>));   // 첫 화면을 그린 뒤에 엔진을 시작한다(아직 DOM을 직접 찾는 코드가 있다)
boot();
