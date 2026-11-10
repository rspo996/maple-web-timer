import test from 'node:test';
import assert from 'node:assert/strict';
import { TTS_URL, adoptManifest, buildTtsRequest, clipPath, emptyManifest, encodeMp3, extractAudioBase64, manifestGet, manifestSet, parseEnvKey, pcmFromAudio } from '../scripts/voice-lib.mjs';
import { VOICE_MODEL, VOICE_STYLE } from '../src/core/voice-phrases.js';

function wav(samples, rate = 24000) {   // 모노 16비트 WAV
  const b = Buffer.alloc(44 + samples.length * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40); samples.forEach((s, i) => b.writeInt16LE(s, 44 + i * 2)); return b;
}

test('buildTtsRequest: 문서의 Interactions 요청 모양, 키는 헤더로', () => {
  const r = buildTtsRequest({ text: '룬이 나왔어요', voice: 'Kore', key: 'K' });
  assert.equal(r.url, TTS_URL); assert.equal(r.init.method, 'POST'); assert.equal(r.init.headers['x-goog-api-key'], 'K');
  assert.deepEqual(JSON.parse(r.init.body), { model: VOICE_MODEL, input: [{ type: 'user_input', content: [{ type: 'text', text: '룬이 나왔어요', annotations: [{ type: 'speech_metadata', style: VOICE_STYLE }] }] }],
    response_format: { type: 'audio' }, generation_config: { speech_config: [{ voice: 'Kore' }] } });
});

test('extractAudioBase64: Interactions 응답과 generateContent 응답, 없으면 오류', () => {
  assert.equal(extractAudioBase64({ steps: [{ type: 'thought', content: [] }, { type: 'model_output', content: [{ type: 'audio', data: 'QUJD' }] }] }), 'QUJD');
  assert.equal(extractAudioBase64({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: 'REVG' } }] } }] }), 'REVG');
  assert.equal(extractAudioBase64({ candidates: [{ content: { parts: [null, { inlineData: { data: 'WFla' } }] } }] }), 'WFla');
  assert.throws(() => extractAudioBase64({ steps: [] }), /응답에 음성이 없어요/);
});

test('pcmFromAudio: WAV는 헤더를 읽고, 헤더가 없으면 24kHz 모노 16비트로 본다', () => {
  const w = pcmFromAudio(wav([1, -2, 300], 22050));
  assert.equal(w.sampleRate, 22050); assert.deepEqual([...w.samples], [1, -2, 300]);
  const raw = Buffer.alloc(4); raw.writeInt16LE(5, 0); raw.writeInt16LE(-6, 2);
  const r = pcmFromAudio(raw); assert.equal(r.sampleRate, 24000); assert.deepEqual([...r.samples], [5, -6]);
});

test('encodeMp3: MPEG 프레임으로 시작하는 MP3', () => {
  const s = new Int16Array(4800).map((_, i) => Math.round(Math.sin(i / 8) * 8000));
  const mp3 = encodeMp3(s, 24000);
  assert.ok(mp3.length > 100); assert.equal(mp3[0], 0xff); assert.equal(mp3[1] & 0xe0, 0xe0);
});

test('parseEnvKey: GEMINI_API_KEY 한 줄, 따옴표·주석·다른 줄 무시', () => {
  assert.equal(parseEnvKey('GEMINI_API_KEY=abc123'), 'abc123');
  assert.equal(parseEnvKey('# x\nOTHER=1\nGEMINI_API_KEY = "q-w_e" # 메모\n'), 'q-w_e');
  assert.equal(parseEnvKey('OTHER=1'), null);
  assert.equal(parseEnvKey('GEMINI_API_KEY=\nOTHER_SECRET=sk-123'), null);
  assert.equal(parseEnvKey('export GEMINI_API_KEY=abc'), 'abc');
  assert.equal(parseEnvKey('GEMINI_API_KEY=abc\r\nOTHER=1'), 'abc');
});

test('clipPath: 목소리 폴더 + 문구 sha1 앞 12자', () => {
  assert.match(clipPath('Kore', '룬이 나왔어요'), /^Kore\/[0-9a-f]{12}\.mp3$/);
  assert.equal(clipPath('Kore', 'a'), clipPath('Kore', 'a')); assert.notEqual(clipPath('Kore', 'a'), clipPath('Kore', 'b'));
});

test('manifest: 새로 만들기, 넣고 꺼내기, 모델·말투가 같을 때만 이어서', () => {
  const m = emptyManifest(); assert.equal(m.version, 1); assert.equal(m.voices.length, 6);
  manifestSet(m, 'Kore', 'a', 'Kore/1.mp3'); assert.equal(manifestGet(m, 'Kore', 'a'), 'Kore/1.mp3'); assert.equal(manifestGet(m, 'Puck', 'a'), null);
  assert.deepEqual(adoptManifest(JSON.parse(JSON.stringify(m))).files, m.files);
  assert.deepEqual(adoptManifest({ ...m, style: '다른 말투' }).files, {});
  assert.deepEqual(adoptManifest(null).files, {});
});
