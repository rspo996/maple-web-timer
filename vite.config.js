import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

// 묶음 7: 빌드마다 버전 값 하나를 만들어 앱 코드(__APP_VERSION__)와 dist/version.json에 같이 넣는다. 개발 서버는 id 'dev'
function shortSha() {
  const env = process.env.VERCEL_GIT_COMMIT_SHA;
  if (env) return env.slice(0, 7);
  try { return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { return ''; }
}
function buildVersion() {
  const sha = shortSha(), builtAt = new Date().toISOString();
  return { id: sha ? `${sha}-${builtAt}` : builtAt, sha, builtAt };
}

export default defineConfig(({ command }) => {
  const version = command === 'build' ? buildVersion() : { id: 'dev', sha: '', builtAt: '' };
  return {
    base: './',          // 호스팅할 곳이 정해지지 않아 하위 경로(예: GitHub Pages)에서도 열리도록 상대 경로로 빌드한다
    appType: 'mpa',      // 화면 이동이 없는 한 페이지 앱. 모르는 경로는 404(브라우저 시험이 앱이 없는 같은 origin 페이지에서 저장소를 비운다)
    define: { __APP_VERSION__: JSON.stringify(version) },
    plugins: [
      react(),
      { name: 'version-json', apply: 'build',
        generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(version) }); } },
    ],
  };
});
