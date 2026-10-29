import assert from 'node:assert/strict';
import test from 'node:test';
import { mediaSource, matchingProgress, resumePosition, unfinishedProgress, orderedEpisodes, orderedSeasons, orderedMiniParts, contentCategory } from '../src/lib/viewing.ts';
import { progressPayload, createProgressWriter } from '../src/lib/progress-writer.ts';
const tick = () => new Promise(resolve => setImmediate(resolve));
const payload = (position = 10) => progressPayload(14, null, position, 100);
test('source parsing accepts exact YouTube hosts and rejects unsupported protocols', () => {
  assert.equal(mediaSource('https://youtu.be/abcdefghijk').videoId, 'abcdefghijk');
  assert.equal(mediaSource('https://www.youtube.com/embed/abcdefghijk').kind, 'youtube');
  assert.equal(mediaSource('https://youtube.com.attacker.test/watch?v=abcdefghijk').kind, 'direct');
  assert.equal(mediaSource('javascript:alert(1)'), null); assert.equal(mediaSource('https://youtube.com/watch?v=bad'), null);
});
test('episode, season and mini-part sorting is numeric and deduplicated', () => {
  for (const [fn, field] of [[orderedEpisodes,'episode_number'], [orderedSeasons,'season_number'], [orderedMiniParts,'miniseries_no']]) {
    assert.deepEqual(fn([{id:2,[field]:10},{id:1,[field]:2},{id:1,[field]:2}]).map(p=>p.id), [1,2]);
  }
  assert.equal(contentCategory('documentary'), 'Documentaries'); assert.equal(contentCategory('animations'), 'Animations');
});
test('resume is specific to the selected episode and excludes completed or near-complete progress', () => {
  const progress = {episode:4,miniseries:null,position_seconds:30,duration_seconds:100,completed:false};
  assert.equal(matchingProgress(progress, {episode:4}), true); assert.equal(matchingProgress(progress, {episode:5}), false);
  assert.equal(resumePosition(progress),30); assert.equal(resumePosition({...progress,completed:true}),0);
  assert.equal(resumePosition({...progress,position_seconds:95}),0); assert.equal(resumePosition(progress,31),0);
});
test('Continue Watching excludes unavailable, duplicate and completed titles', () => {
  const row = (id, status='approved', extra={}) => ({content:{id,status},position_seconds:20,duration_seconds:100,completed:false,updated_at:'2026-10-01',...extra});
  const newer = row(1,'approved',{updated_at:'2026-10-02'});
  assert.deepEqual(unfinishedProgress([row(1),newer,row(2,'preview'),row(3,'approved',{completed:true}),row(4,'approved',{position_seconds:0})]),[newer]);
});
test('progress uses measured finite durations and rounds without premature completion', () => {
  assert.equal(progressPayload(1,null,1,Infinity),null); assert.equal(progressPayload(1,null,4,100),null);
  assert.equal(progressPayload(1,{episode:8},94.7,100.4).duration_seconds,101);
  assert.equal(progressPayload(1,null,100.4,100.4,true).position_seconds,101);
  assert.equal(progressPayload(1,null,40,100,true).position_seconds,40);
});
test('writer throttles periodic progress, serializes requests and sends the latest seek on pause', async () => {
  let time=0, release; const sent=[];
  const writer=createProgressWriter(p=>{sent.push(p);return new Promise(r=>{release=r;});},()=>assert.fail('unexpected failure'),()=>time);
  writer.sample(payload()); writer.sample(payload(15)); writer.sample(payload(20),true);
  assert.equal(sent.length,1); release(); await tick(); assert.equal(sent.length,2); assert.equal(sent[1].position_seconds,20);
  release(); await tick(); writer.sample(payload(21)); assert.equal(sent.length,2);
  time=15001;writer.sample(payload(22));assert.equal(sent.length,3);release();await tick();writer.sample(payload(22),true);assert.equal(sent.length,3);
});
test('failed writes stop until explicit retry; final queued progress survives unmount', async () => {
  let failed=0, count=0;const sent=[];
  const writer=createProgressWriter(async p=>{count++;if(count===1)throw Error('offline');sent.push(p);},()=>failed++);
  writer.sample(payload());await tick();writer.sample(payload(20),true);await tick();assert.equal(count,1);assert.equal(failed,1);
  writer.retry();await tick();assert.equal(sent[0].position_seconds,20);
  let release;const final=[];const other=createProgressWriter(p=>{final.push(p);return new Promise(r=>{release=r;});},()=>{});
  other.sample(payload());other.sample(payload(30),true);other.flush();other.dispose();release();await tick();assert.equal(final[1].position_seconds,30);release();await tick();
});
