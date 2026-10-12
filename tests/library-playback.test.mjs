import assert from 'node:assert/strict';
import test from 'node:test';
import { checkpoint, progressPartKey, shouldSaveCheckpoint } from '../src/lib/library-playback.ts';

test('mobile-compatible progress identifies the latest episode or miniseries part', () => {
  assert.equal(progressPartKey({ episode: 12, miniseries: null }), 'episode:12');
  assert.equal(progressPartKey({ episode: null, miniseries: 8 }), 'part:8');
  assert.equal(progressPartKey({ episode: null, miniseries: null }), null);
  assert.deepEqual(checkpoint(3, 32.9, 100.7, 12, null), {
    content: 3, episode: 12, miniseries: null,
    position_seconds: 32, duration_seconds: 100,
  });
});

test('checkpoints wait 15 seconds, flush on pause, and mark near-completion', () => {
  assert.equal(shouldSaveCheckpoint(4, -1, 100), false);
  assert.equal(shouldSaveCheckpoint(10, 0, 100), false);
  assert.equal(shouldSaveCheckpoint(15, 0, 100), true);
  assert.equal(shouldSaveCheckpoint(16, 15, 100), false);
  assert.equal(shouldSaveCheckpoint(16, 15, 100, true), true);
  assert.equal(shouldSaveCheckpoint(16, 16, 100, true), false);
  assert.equal(shouldSaveCheckpoint(95, 90, 100), true);
  assert.equal(shouldSaveCheckpoint(96, 95, 100), false);
});
