// Local desktop Chrome with actual generated media; AWS/Google APIs are fixtures.
// Build with NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:18041, then run this file.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve('.next/playback-media-proof');
mkdirSync(root, { recursive: true });
function encode(args) {
  const result = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', ...args], { windowsHide: true });
  assert.equal(result.status, 0, result.stderr?.toString());
}
for (const height of [180, 360]) {
  const dir = join(root, `${height}p`); mkdirSync(dir, { recursive: true });
  encode(['-f', 'lavfi', '-i', `testsrc2=size=${height * 16 / 9}x${height}:rate=15`, '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '18', '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-g', '30', '-sc_threshold', '0', '-c:a', 'aac',
    '-f', 'hls', '-hls_time', '2', '-hls_list_size', '0', '-hls_playlist_type', 'vod', join(dir, 'index.m3u8')]);
}
encode(['-f', 'lavfi', '-i', 'color=c=blue:s=640x360:r=15', '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000',
  '-t', '1.2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', join(root, 'trailer.mp4')]);
writeFileSync(join(root, 'master.m3u8'), '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=320x180\n180p/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=640x360\n360p/index.m3u8\n');
const api = 'http://127.0.0.1:18041';
const program = { id: 1, title: 'Local HLS fixture', content_type: 'movie', category: 'movies', format: 'standalone',
  status: 'approved', description: 'Generated playback fixture', streaming_link: null, playback_available: true,
  trailer_link: `${api}/media/trailer.mp4`, channel: 1, thumbnail: null, duration: '00:00:18', genres: [] };
let savedPosition = 0;
const requests = [], writes = [], selections = [];
const discoveryEvents = [];
const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3014');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, api);
  let owner = null;
  try { owner = JSON.parse(Buffer.from((req.headers.authorization || '').split('.')[1], 'base64url')).user_id; } catch {}
  requests.push({ path: url.pathname, owner });
  const json = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  if (url.pathname.startsWith('/media/')) {
    const relative = url.pathname.slice(7);
    if (relative.includes('..')) { res.writeHead(404); res.end(); return; }
    if (relative !== 'trailer.mp4' && !req.headers.cookie?.includes('fixture-grant=yes')) { res.writeHead(403); res.end(); return; }
    const path = join(root, relative);
    if (!existsSync(path)) { res.writeHead(404); res.end(); return; }
    const data = readFileSync(path), range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    res.setHeader('Content-Type', path.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : path.endsWith('.ts') ? 'video/mp2t' : 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    if (range) {
      const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
      res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': end - start + 1 }); res.end(data.subarray(start, end + 1));
    } else { res.setHeader('Content-Length', data.length); res.end(data); }
    return;
  }
  if (url.pathname === '/api/content/1/') return json(program);
  if (url.pathname === '/api/content/2/') return json({ ...program, id: 2, title: 'Local series fixture', content_type: 'series', format: 'series', playback_available: false });
  if (url.pathname === '/api/content/seasons/') return json({ count: 1, next: null, results: [{ id: 2, content: 2, title: 'Fixture season', season_number: 1 }] });
  if (url.pathname === '/api/content/episodes/') {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return json({ count: 2, next: null, results: [21, 22].map((id, index) => ({ id, season: 2, title: `Fixture episode ${index + 1}`, episode_number: index + 1, streaming_link: null, playback_available: true })) });
  }
  if (/^\/api\/content\/[12]\/playback\/$/.test(url.pathname)) {
    if (!owner) return json({ detail: 'Authentication required' }, 401);
    let body = ''; for await (const part of req) body += part;
    selections.push({ path: url.pathname, owner, ...JSON.parse(body || '{}') });
    res.setHeader('Set-Cookie', 'fixture-grant=yes; HttpOnly; SameSite=Lax; Path=/media/; Max-Age=60');
    return json({ state: 'ready', url: `${api}/media/master.m3u8`, type: 'hls', with_credentials: true,
      session_id: '00000000-0000-4000-8000-000000000001', expires_at: new Date(Date.now() + 900000).toISOString() });
  }
  if (url.pathname === '/api/discovery/events/' && req.method === 'POST') {
    let body = ''; for await (const part of req) body += part;
    discoveryEvents.push({ owner, ...JSON.parse(body || '{}') }); return json({ accepted: true }, 201);
  }
  if (url.pathname === '/api/discovery/similar/1/') return json({ items: [{ ...program, id: 2, title: 'Related fixture' }] });
  if (url.pathname === '/api/discovery/similar/2/') return json({ items: [{ ...program }] });
  if (url.pathname === '/api/discovery/rankings/trending/') return json({ items: [program], available: true, stale: false });
  if (url.pathname === '/api/discovery/rankings/most-watched/') return json({ items: [program], available: true, stale: false });
  if (url.pathname === '/api/discovery/recommended/') return owner ? json({ items: [program], personalized: false, reason: 'cold_start' }) : json({}, 401);
  if (url.pathname === '/api/accounts/profile/') return owner ? json({ id: owner, name: `Fixture ${owner}`, email: `fixture${owner}@example.invalid` }) : json({}, 401);
  if (url.pathname === '/api/library/progress/1/') return owner && savedPosition ? json({ id: 1, content: program, position_seconds: savedPosition,
    duration_seconds: 18, completed: false, episode: null, miniseries: null }) : json({}, 404);
  if (url.pathname === '/api/library/progress/2/') return json({}, 404);
  if (url.pathname === '/api/library/progress/' && req.method === 'POST') {
    let body = ''; for await (const part of req) body += part;
    writes.push({ owner, ...JSON.parse(body) }); return json({});
  }
  if (url.pathname === '/api/homepage/') return json({ sections: [] });
  if (url.pathname === '/api/content/') return json({ count: 1, next: null, results: [program] });
  return json({ count: 0, next: null, results: [] });
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(18041, '127.0.0.1', resolve); });
for (const path of ['master.m3u8', '360p/index.m3u8', '360p/index0.ts']) assert.equal((await fetch(`${api}/media/${path}`)).status, 403);
const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3014', '-H', '127.0.0.1'], { stdio: 'ignore', windowsHide: true });
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run',
  '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=9344', `--user-data-dir=${root}/chrome-${process.pid}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket, serial = 0;
const pending = new Map();
function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) {
  const { result } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression, milliseconds = 20000) {
  const until = Date.now() + milliseconds;
  while (Date.now() < until) { if (await evaluate(`Boolean(${expression})`).catch(() => false)) return; await delay(100); }
  throw new Error(`Timed out: ${expression}; ${await evaluate('document.body.innerText').catch(() => '')}`);
}
const token = id => `fixture.${Buffer.from(JSON.stringify({ user_id: id, exp: 9999999999 })).toString('base64url')}.signature`;
try {
  let endpoint;
  for (let i = 0; i < 100; i++) {
    try { endpoint = (await fetch('http://127.0.0.1:9344/json/list', { signal: AbortSignal.timeout(1000) }).then(r => r.json())).find(p => p.type === 'page')?.webSocketDebuggerUrl; if (endpoint) break; } catch {}
    await delay(100);
  }
  assert.ok(endpoint, 'Chrome DevTools startup');
  socket = new WebSocket(endpoint); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => { const p = JSON.parse(data), task = pending.get(p.id); if (task) { pending.delete(p.id); if (p.error) task.reject(new Error(p.error.message)); else task.resolve(p); } };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "if(!sessionStorage.getItem('branch4-proof-started')){localStorage.clear();sessionStorage.setItem('branch4-proof-started','1');}window.playbackMetrics=[];window.addEventListener('cbmtv:playback-metric',e=>window.playbackMetrics.push(e.detail));" });
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:3014')).ok) break; } catch {} await delay(100); }
  const navigate = async path => { await send('Page.navigate', { url: `http://127.0.0.1:3014${path}` }); await waitFor('document.querySelector(".watch-layout")'); };
  await navigate('/programs/1');
  await waitFor("Array.from(document.querySelectorAll('a')).some(a => a.textContent === 'Sign in to watch')");
  await waitFor("document.body.innerText.includes('Related fixture')");
  assert.equal(requests.filter(r => r.path.endsWith('/playback/')).length, 0, 'anonymous trailer completion cannot authorize main');
  const returnTo = await evaluate("Array.from(document.querySelectorAll('a')).find(a => a.textContent === 'Sign in to watch').getAttribute('href')");
  assert.match(returnTo, /programs%2F1%3Fplay%3D1/);
  await evaluate(`localStorage.setItem('access_token',${JSON.stringify(token(1))});localStorage.setItem('refresh_token',${JSON.stringify(token(1))});`);
  await navigate('/programs/1');
  await waitFor('document.querySelector("video")?.currentTime>1 && document.querySelector("video")?.currentSrc.includes("master.m3u8")');
  const nativeMetrics = await evaluate('window.playbackMetrics');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "const originalCanPlayType=HTMLMediaElement.prototype.canPlayType;HTMLMediaElement.prototype.canPlayType=function(type){return /mpegurl/i.test(type)?'':originalCanPlayType.call(this,type);};" });
  await navigate('/programs/1?play=1');
  await waitFor('document.querySelector("video")?.currentSrc.includes("blob:") && document.querySelector("video")?.currentTime>1');
  const metrics = await evaluate('window.playbackMetrics');
  assert.ok(metrics.some(m => m.name === 'startup'), 'actual video playing records startup');
  const qualities = await evaluate(`document.querySelector("select[aria-label='Video quality']")?.options.length || 0`);
  if (qualities > 2) {
    await evaluate(`document.querySelector("select[aria-label='Video quality']").value="0";document.querySelector("select[aria-label='Video quality']").dispatchEvent(new Event("change",{bubbles:true}));`);
    await waitFor('window.playbackMetrics.some(m=>m.name==="quality" && m.level===0)');
  }
  const qualityMetrics = await evaluate('window.playbackMetrics');
  savedPosition = 5;
  await navigate('/programs/1?play=1');
  await waitFor('document.querySelector("video")?.currentTime>=5 && !document.querySelector("video")?.paused');
  const resumed = await evaluate('document.querySelector("video").currentTime');
  const oldWrites = writes.length;
  await evaluate(`localStorage.setItem('access_token',${JSON.stringify(token(2))});localStorage.setItem('refresh_token',${JSON.stringify(token(2))});window.dispatchEvent(new StorageEvent('storage',{key:'refresh_token'}));`);
  await waitFor('document.querySelector("video")?.currentTime>=5 && !document.querySelector("video")?.paused');
  await delay(1500);
  assert.ok(requests.some(r => r.path.endsWith('/playback/') && r.owner === 2), 'new account obtains its own grant');
  // An old-account write already in flight may reach the server after the switch;
  // it must retain the old account's authorization. Force a new sample and check it.
  await evaluate('document.querySelector("video").pause()');
  for (let i = 0; i < 30 && !writes.slice(oldWrites).some(r => r.owner === 2); i++) await delay(100);
  assert.ok(writes.slice(oldWrites).some(r => r.owner === 2), 'new account writes its own progress');
  assert.ok(writes.every(r => r.owner === 1 || r.owner === 2), 'all progress writes have a valid owner');
  const layouts = [];
  for (const width of [390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await delay(300);
    const layout = await evaluate('(() => { const player=document.querySelector(".player-band").getBoundingClientRect(); const info=document.querySelector(".watch-sidebar").getBoundingClientRect(); return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,controls:document.querySelector("video").controls,playerWidth:player.width,playerBottom:player.bottom,infoLeft:info.left,infoTop:info.top}; })()');
    assert.ok(layout.scrollWidth <= layout.width + 1, 'player has no viewport overflow'); assert.ok(layout.controls);
    if (width >= 1200) assert.ok(layout.playerWidth < layout.width * .8 && layout.infoLeft >= layout.playerWidth, 'desktop keeps the original player and side information split');
    else assert.ok(layout.infoTop >= layout.playerBottom, 'mobile information follows the unchanged player');
    layouts.push(layout);
    const { result } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(root, `${width}.png`), Buffer.from(result.data, 'base64'));
  }
  await evaluate("document.querySelector('[aria-label=\"Player options\"]').click()");
  await waitFor("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Cinema mode')");
  await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Cinema mode').click()");
  await waitFor("document.querySelector('.watch-layout')?.dataset.playerMode==='theater'");
  const cinemaFrame = await evaluate("(() => { const frame=document.querySelector('.player-frame').getBoundingClientRect(); return { width:frame.width, height:frame.height, viewportWidth:innerWidth, viewportHeight:innerHeight }; })()");
  assert.ok(cinemaFrame.width <= cinemaFrame.viewportWidth + 1 && cinemaFrame.height <= cinemaFrame.viewportHeight + 1, 'cinema player stays within the viewport');
  await evaluate("document.querySelector('[aria-label=\"Player options\"]').click()");
  await waitFor("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Exit cinema mode')");
  await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Exit cinema mode').click()");
  await waitFor("document.querySelector('.watch-layout')?.dataset.playerMode==='standard'");
  const finalMetrics = await evaluate('window.playbackMetrics');
  assert.ok(![...nativeMetrics, ...qualityMetrics, ...finalMetrics].some(metric => metric.name === 'error'));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  await navigate('/programs/2');
  await waitFor("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Skip trailer')");
  const skipPosition = await evaluate(`(() => { const frame = document.querySelector('.player-frame').getBoundingClientRect(); const skip = document.querySelector('.skip-trailer').getBoundingClientRect(); return { right: frame.right - skip.right, bottom: frame.bottom - skip.bottom }; })()`);
  assert.ok(skipPosition.right >= 8 && skipPosition.right <= 24, 'trailer Skip sits near the video right edge');
  assert.ok(skipPosition.bottom >= 45 && skipPosition.bottom <= 72, 'trailer Skip stays low and clears native controls');
  await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Skip trailer').click()");
  await waitFor('document.querySelector("video")?.currentSrc.includes("blob:") && document.querySelector("video")?.currentTime>0.5');
  assert.ok(selections.some(item=>item.path==='/api/content/2/playback/' && item.episode===21), 'fast Skip waits for delayed episodes and selects first');
  await navigate('/programs/2?play=1&episode=999');
  await waitFor('document.body.innerText.includes("requested episode") || document.body.innerText.includes("Requested episode")');
  await send('Page.navigate', { url: 'http://127.0.0.1:3014/programs' });
  await waitFor("document.body.innerText.includes('Trending Now') && document.body.innerText.includes('Most Watched') && document.body.innerText.includes('Explore for You')");
  for (const width of [390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await delay(300);
    const layout = await evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})');
    assert.ok(layout.scrollWidth <= layout.width + 1, 'discovery rails have no viewport overflow');
  }
  assert.ok(discoveryEvents.some(event => event.type === 'detail_opened'), 'detail opening emits an event');
  assert.ok(discoveryEvents.some(event => event.type === 'playback_started' && event.owner), 'authorized playback emits an owner-bound start');
  writeFileSync(join(root, 'results.json'), JSON.stringify({ environment: 'headless desktop Chrome, local generated H264/AAC, fixture API; no AWS or real device',
    anonymous_trailer_to_signin: true, authenticated_trailer_to_hls: true, resumed_seconds: resumed, manual_quality_options: qualities,
    account_switch: true, fast_episode_skip: true, unavailable_episode: true, layouts, nativeMetrics, metrics, qualityMetrics, finalMetrics, writes, selections,
    discovery_events: discoveryEvents, discovery_rails: true,
    javascript_path: 'Native HLS capability suppressed for this phase; actual hls.js MSE decoding and segment requests.' }, null, 2));
  console.log(JSON.stringify({ passed: true, artifact: join(root, 'results.json'), metrics, resumed_seconds: resumed, layouts }));
} finally {
  socket?.close(); chrome.kill(); next.kill(); server.closeAllConnections(); server.close();
}
