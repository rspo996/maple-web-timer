import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',          // 호스팅할 곳이 정해지지 않아 하위 경로(예: GitHub Pages)에서도 열리도록 상대 경로로 빌드한다
  appType: 'mpa',      // 화면 이동이 없는 한 페이지 앱. 모르는 경로는 404(브라우저 시험이 앱이 없는 같은 origin 페이지에서 저장소를 비운다)
  plugins: [react()],
});
