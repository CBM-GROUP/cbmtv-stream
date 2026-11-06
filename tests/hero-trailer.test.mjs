import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/components/HeroTrailer.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const context = { exports: {}, URL, require: name => {
  if (name === 'react') return {};
  if (name === './TrackedYouTube') return {};
  if (name === 'react/jsx-runtime') return { jsx: () => null };
  throw new Error(`Unexpected dependency: ${name}`);
} };
vm.runInNewContext(code, context);

test('hero trailer recognizes playable direct, HLS, and YouTube URLs', () => {
  const classify = context.exports.trailerSource;
  assert.equal(classify('https://media.example/trailer.mp4').kind, 'video');
  assert.equal(classify('https://media.example/trailer.m3u8?token=abc').kind, 'hls');
  assert.equal(classify('https://youtu.be/dQw4w9WgXcQ').videoId, 'dQw4w9WgXcQ');
  assert.equal(classify('https://www.youtube.com/watch?v=dQw4w9WgXcQ').kind, 'youtube');
  assert.equal(classify('javascript:alert(1)').kind, 'invalid');
});
