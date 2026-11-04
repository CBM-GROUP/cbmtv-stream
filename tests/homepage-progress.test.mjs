import test from 'node:test';
import assert from 'node:assert/strict';
import { resumePosition, progressSample, progressTokenBelongsToUser } from '../src/lib/homepage-progress.ts';

test('progress credentials belong to the player account even after another tab changes storage', () => {
  const token = id => `header.${Buffer.from(JSON.stringify({ user_id: id })).toString('base64url')}.signature`;
  assert.equal(progressTokenBelongsToUser(token(12), 12), true);
  assert.equal(progressTokenBelongsToUser(token('12'), 12), true);
  assert.equal(progressTokenBelongsToUser(token(13), 12), false);
  assert.equal(progressTokenBelongsToUser(null, 12), false);
  assert.equal(progressTokenBelongsToUser('invalid', 12), false);
});

test('resume position belongs to the selected episode/part and unfinished playback', () => {
  const progress = { position_seconds: 42, completed: false, episode: 7, miniseries: null };
  assert.equal(resumePosition(progress, 7), 42);
  assert.equal(resumePosition(progress, 8), 0);
  assert.equal(resumePosition(progress), 0);
  assert.equal(resumePosition({ ...progress, completed: true }, 7), 0);
  assert.equal(resumePosition({ ...progress, episode: null, miniseries: 4 }, undefined, 4), 42);
  assert.equal(resumePosition(null), 0);
});
test('progress samples reject missing duration and invalid player values', () => {
  assert.equal(progressSample(Infinity, 60), null);
  assert.equal(progressSample(10, NaN), null);
  assert.equal(progressSample(10, 0), null);
  assert.equal(progressSample(-1, 60), null);
  assert.deepEqual(progressSample(42.7, 60.8), { position_seconds: 42, duration_seconds: 60 });
  assert.deepEqual(progressSample(70, 60), { position_seconds: 60, duration_seconds: 60 });
});
