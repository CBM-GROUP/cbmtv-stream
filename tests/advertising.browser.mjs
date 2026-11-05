// Local desktop Chrome with actual generated media; AWS/Google APIs are fixtures.
// Build with NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:18041, then run this file.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve('.next/advertising-proof');
mkdirSync(root, { recursive: true });
function encode(args) {
  const result = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', ...args], { windowsHide: true });
  assert.equal(result.status, 0, result.stderr?.toString());
}
for (const height of [180, 360]) {
  const dir = join(root, `${height}p`); mkdirSync(dir, { recursive: true });
  encode(['-f', 'lavfi', '-i', `testsrc2=size=${height * 16 / 9}x${height}:rate=15`, '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '75', '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-g', '30', '-sc_threshold', '0', '-c:a', 'aac',
    '-f', 'hls', '-hls_time', '2', '-hls_list_size', '0', '-hls_playlist_type', 'vod', join(dir, 'index.m3u8')]);
}
encode(['-f', 'lavfi', '-i', 'color=c=blue:s=640x360:r=15', '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000',
  '-t', '1.2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', join(root, 'trailer.mp4')]);
writeFileSync(join(root, 'master.m3u8'), '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=320x180\n180p/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=640x360\n360p/index.m3u8\n');
mkdirSync(join(root, 'ad'), { recursive: true });
encode(['-f', 'lavfi', '-i', 'color=c=orange:s=640x360:r=15', '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=48000', '-t', '6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-g', '30', '-f', 'hls', '-hls_time', '2', '-hls_list_size', '0', '-hls_playlist_type', 'vod', join(root, 'ad', 'master.m3u8')]);
encode(['-f', 'lavfi', '-i', 'color=c=teal:s=1200x300', '-frames:v', '1', join(root, 'banner.png')]);
const api = 'http://127.0.0.1:18041';
const program = { id: 1, title: 'Local HLS fixture', content_type: 'movie', category: 'movies', format: 'standalone',
  status: 'approved', description: 'Generated playback fixture', streaming_link: null, playback_available: true,
  trailer_link: `${api}/media/trailer.mp4`, channel: 1, thumbnail: null, duration: '00:01:15', genres: [] };
let savedPosition = 0;
const requests = [], writes = [], selections = [];
const discoveryEvents = [];
const adRequests = [], adEvents = [], issued = new Map();
let sequence = 0, failPreroll = false, serverAdsEnabled = true;
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
    if (!['trailer.mp4', 'banner.png'].includes(relative) && !req.headers.cookie?.includes('fixture-grant=yes')) { res.writeHead(403); res.end(); return; }
    const path = join(root, relative);
    if (!existsSync(path)) { res.writeHead(404); res.end(); return; }
    const data = readFileSync(path), range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    res.setHeader('Content-Type', path.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : path.endsWith('.ts') ? 'video/mp2t' : path.endsWith('.png') ? 'image/png' : 'video/mp4');
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
      advertising_enabled: serverAdsEnabled, session_id: `fixture-${owner}-${url.pathname}-${selections.at(-1).episode ?? 'movie'}`, expires_at: new Date(Date.now() + 900000).toISOString() });
  }
  if (url.pathname === '/api/advertising/session/') {
    if (!serverAdsEnabled) return json({ enabled: false, session: null, placements: [] });
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || '{}');
    return json({ enabled: true, session: `${owner ?? 'anonymous'}:${body.context}:${body.playback_session ?? body.content ?? body.channel ?? 'home'}`,
      placements: body.context === 'playback' ? [{ code: 'preroll', breakpoints: [] }, { code: 'midroll', breakpoints: [60] }, { code: 'postroll', breakpoints: [] }] : [{ code: body.context === 'homepage' ? 'homepage_banner' : body.context === 'channel' ? 'channel_sponsor' : 'content_sponsor', breakpoints: [] }] });
  }
  if (url.pathname === '/api/advertising/decision/') {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || '{}'); adRequests.push({ owner, ...body });
    const key = `${body.session}:${body.placement}:${body.break_key}`;
    const video = ['preroll', 'midroll', 'postroll'].includes(body.placement);
    if (!issued.has(key)) issued.set(key, { decision_id: `ad-${++sequence}`, kind: video ? 'video' : 'image',
      name: 'Local sponsor fixture', advertiser: 'Fixture sponsor', destination_url: 'https://brand.example/offer', cta: 'Visit sponsor',
      url: video ? `${api}/media/${body.placement === 'midroll' || failPreroll && body.placement === 'preroll' ? 'missing.m3u8' : 'ad/master.m3u8'}` : `${api}/media/banner.png`,
      mobile_url: `${api}/media/banner.png`, width: 1200, height: 300, source_type: 'hls', with_credentials: true,
      duration_seconds: 6, skippable_after: body.placement === 'preroll' ? 2 : null, expires_at: new Date(Date.now() + 900000).toISOString() });
    return json({ ad: issued.get(key) });
  }
  if (url.pathname === '/api/advertising/events/') {
    let raw = ''; for await (const chunk of req) raw += chunk;
    adEvents.push({ owner, ...JSON.parse(raw || '{}') }); return json({ accepted: true });
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
    duration_seconds: 75, completed: false, episode: null, miniseries: null }) : json({}, 404);
  if (url.pathname === '/api/library/progress/2/') return json({}, 404);
  if (url.pathname === '/api/library/progress/' && req.method === 'POST') {
    let body = ''; for await (const part of req) body += part;
    writes.push({ owner, ...JSON.parse(body) }); return json({});
  }
  if (url.pathname === '/api/homepage/') return json({ sections: [{ id: 'homepage_banner', label: 'Sponsor banner', enabled: true, source: 'advertising', items: [] }] });
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
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "const originalCanPlayType=HTMLMediaElement.prototype.canPlayType;HTMLMediaElement.prototype.canPlayType=function(type){return /mpegurl/i.test(type)?'':originalCanPlayType.call(this,type);};" });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "if(!sessionStorage.getItem('branch4-proof-started')){localStorage.clear();sessionStorage.setItem('branch4-proof-started','1');}window.playbackMetrics=[];window.advertisingMetrics=[];window.addEventListener('cbmtv:playback-metric',e=>window.playbackMetrics.push(e.detail));window.addEventListener('cbmtv:advertising-metric',e=>window.advertisingMetrics.push(e.detail));" });
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:3014')).ok) break; } catch {} await delay(100); }
  const navigate = async path => { await send('Page.navigate', { url: `http://127.0.0.1:3014${path}` }); await waitFor('document.querySelector(".watch-layout")'); };

  await navigate('/programs/1');
  await waitFor("Array.from(document.querySelectorAll('a')).some(a => a.textContent === 'Sign in to watch')");
  assert.equal(adRequests.filter(r=>r.placement==='preroll').length, 0, 'anonymous trailer does not request video ads');
  await evaluate(`localStorage.setItem('access_token',${JSON.stringify(token(1))});localStorage.setItem('refresh_token',${JSON.stringify(token(1))});`);
  await navigate('/programs/1');
  await waitFor('document.querySelector("video:not([controls])")?.currentTime>.3');
  const organicBeforeAd = discoveryEvents.filter(e=>e.type==='playback_started').length;
  assert.equal(organicBeforeAd, 0, 'pre-roll does not become an organic start');
  const layouts = [];
  for (const width of [390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await delay(200);
    const layout = await evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,controls:document.querySelector("video").controls,label:document.body.innerText.includes("Advertisement")})');
    assert.ok(layout.scrollWidth<=layout.width+1); assert.equal(layout.controls,false); assert.ok(layout.label);
    const { result } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(root, `ad-${width}.png`), Buffer.from(result.data, 'base64')); layouts.push(layout);
  }
  const prerollId = [...issued.entries()].find(([key]) => key.includes(':preroll:'))[1].decision_id;
  for (let i=0;i<60 && !adEvents.some(e=>e.kind==='impression' && e.decision_id===prerollId);i++) await delay(100);
  assert.ok(adEvents.some(e=>e.kind==='video_start'));
  assert.ok(adEvents.some(e=>e.kind==='impression' && e.decision_id===prerollId), 'two seconds of visible playback becomes an impression');
  await evaluate("document.addEventListener('click',e=>e.preventDefault(),{once:true});document.querySelector('.player-frame a[rel]').click()");
  await waitFor("Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Skip ad'&&!b.disabled)");
  await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Skip ad').click()");
  await waitFor('document.querySelector("video[controls]")?.currentTime>.3');
  const mainStartupMs = await evaluate('window.playbackMetrics.filter(m=>m.name==="startup").at(-1).duration_ms');
  const prerolls = adRequests.filter(r=>r.owner===1&&r.placement==='preroll').length;
  await waitFor('document.querySelector("select")');
  await evaluate('const q=document.querySelector("select");q.value="0";q.dispatchEvent(new Event("change",{bubbles:true}))');
  await delay(300);
  assert.equal(adRequests.filter(r=>r.owner===1&&r.placement==='preroll').length,prerolls,'quality switch does not repeat pre-roll');
  await evaluate('document.querySelector("video").currentTime=61');
  const recoveryAt = Date.now();
  await waitFor('document.querySelector("video:not([controls])")');
  await waitFor('document.querySelector("video[controls]")?.currentTime>=61',15000);
  const failureRecoveryMs = Date.now()-recoveryAt;
  assert.ok(adEvents.some(e=>e.kind==='failure'),'broken mid-roll emits failure');
  await evaluate('document.querySelector("video").currentTime=62'); await delay(300);
  assert.equal(adRequests.filter(r=>r.owner===1&&r.placement==='midroll').length,1,'completed or failed break is not repeated');
  await evaluate('document.querySelector("video").currentTime=74.7');
  await waitFor('document.querySelector("video:not([controls])")?.currentTime>.3');
  assert.ok(adRequests.some(r=>r.placement==='postroll'));
  await waitFor('document.body.innerText.includes("Playback finished")',15000);
  assert.ok(adEvents.some(e=>e.kind==='complete'),'post-roll completes');
  assert.ok(adEvents.some(e=>e.kind==='skip'),'configured pre-roll skip recorded');
  assert.ok(adEvents.some(e=>e.kind==='click'),'approved action recorded');
  const metrics = await evaluate('window.advertisingMetrics');
  const paidRequestsBeforeDisabled = adRequests.filter(r=>['preroll','midroll','postroll'].includes(r.placement)).length;
  serverAdsEnabled = false;
  await navigate('/programs/1?play=1');
  await waitFor('document.querySelector("video[controls]")?.currentTime>.3');
  const disabledStartupMs = await evaluate('window.playbackMetrics.filter(m=>m.name==="startup").at(-1).duration_ms');
  assert.equal(adRequests.filter(r=>['preroll','midroll','postroll'].includes(r.placement)).length,paidRequestsBeforeDisabled,'disabled advertising adds no video-ad requests');
  serverAdsEnabled = true;
  // A new owner obtains a distinct server playback/ad session and never sends
  // the old account's decision receipt using the new owner's authorization.
  await navigate('/programs/1?play=1');
  await waitFor('document.querySelector("video:not([controls])")');
  await evaluate(`localStorage.setItem('access_token',${JSON.stringify(token(2))});localStorage.setItem('refresh_token',${JSON.stringify(token(2))});window.dispatchEvent(new StorageEvent('storage',{key:'refresh_token'}));`);
  await waitFor('document.querySelector("video:not([controls])")?.currentTime>.5');
  for(let i=0;i<50&&!adRequests.some(r=>r.owner===2&&r.placement==='preroll');i++) await delay(100);
  assert.ok(adRequests.some(r=>r.owner===2&&r.placement==='preroll'));
  assert.ok(adEvents.every(e=>e.session.startsWith(`${e.owner??'anonymous'}:`)), 'ad receipts remain bound to their viewer');
  await send('Page.navigate',{url:'http://127.0.0.1:3014/'});
  await waitFor('document.querySelector("section img")?.complete');
  await delay(1600);
  const bannerCount=adEvents.filter(e=>e.kind==='impression'&&e.session.includes(':homepage:')).length;
  assert.ok(bannerCount>0,'homepage uses configured sponsored section and visible image impression');
  const { result }=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  writeFileSync(join(root,'homepage.png'),Buffer.from(result.data,'base64'));
  writeFileSync(join(root,'results.json'),JSON.stringify({environment:'Local generated H264/AAC/HLS in headless Chrome; fixture API, no production traffic',
    trailer_before_preroll:true,pre_mid_post:true,quality_dedup:true,break_dedup:true,account_switch:true,homepage_banner:true,
    failure_recovery_ms:failureRecoveryMs,main_startup_ms:mainStartupMs,disabled_startup_ms:disabledStartupMs,layouts,metrics,ad_requests:adRequests,ad_events:adEvents,organic_events:discoveryEvents,progress:writes},null,2));
  console.log(JSON.stringify({passed:true,artifact:join(root,'results.json'),failure_recovery_ms:failureRecoveryMs,main_startup_ms:mainStartupMs,disabled_startup_ms:disabledStartupMs,layouts,metrics}));
} finally {
  socket?.close(); chrome.kill(); next.kill(); server.closeAllConnections(); server.close();
}
