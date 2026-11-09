// Run with the fixture API on :8001 and next start on :3010.
// Screenshots and measurements are saved under .next/ui-corrections.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const artifacts = resolve(".next/ui-corrections");
await mkdir(artifacts, { recursive: true });
const browser = spawn(process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--autoplay-policy=no-user-gesture-required", "--remote-debugging-port=9335", `--user-data-dir=${artifacts}/chrome-${process.pid}`, "about:blank"], { stdio: "ignore", windowsHide: true });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket, nextId = 0, closing = false;
const pending = new Map();
const measurements = [];
function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
}
async function evaluate(expression) {
  const { result } = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await evaluate(`Boolean(${expression})`).catch(() => false)) return; await delay(100); }
  throw new Error(`Timed out: ${expression}`);
}
async function navigate(path) {
  const before = await evaluate("performance.timeOrigin");
  await send("Page.navigate", { url: `http://127.0.0.1:3010${path}` });
  await waitFor(`performance.timeOrigin !== ${before} && document.readyState === 'complete'`);
}
async function screenshot(name) {
  const { result } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(`${artifacts}/${name}.png`, Buffer.from(result.data, "base64"));
}
try {
  let endpoint;
  for (let i = 0; i < 50; i++) {
    try { endpoint = (await fetch("http://127.0.0.1:9335/json/list").then((r) => r.json())).find((tab) => tab.type === "page")?.webSocketDebuggerUrl; if (endpoint) break; } catch { /* Browser is starting. */ }
    await delay(200);
  }
  assert.ok(endpoint, "Chrome DevTools did not start");
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => { const packet = JSON.parse(data), p = pending.get(packet.id); if (!p) return; pending.delete(packet.id); if (packet.error) p.reject(new Error(packet.error.message)); else p.resolve(packet); };
  socket.onclose = () => { if (!closing) { for (const p of pending.values()) p.reject(new Error("Chrome DevTools connection closed")); pending.clear(); } };
  await send("Page.enable"); await send("Runtime.enable");
  await navigate("/");
  await evaluate("localStorage.clear()");
  for (const [name, width, height] of [["mobile-320",320,740], ["mobile-360",360,720], ["mobile-390",390,844], ["tablet-768",768,1024], ["desktop-1024",1024,768], ["desktop-1440",1440,1000]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await navigate("/");
    await waitFor("document.querySelector('.home-catalogue h2')");
    await waitFor("document.querySelector('.hero-media-slide.is-active img')?.naturalWidth > 0");
    const metrics = await evaluate(`(() => {
      const rect = el => { const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}; };
      return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,logo:rect(document.querySelector('header img')),signIn:rect(document.querySelector('header a[href="/sign-in"]')),search:rect(document.querySelector('button[aria-label="Search catalogue"]')),titles:[...document.querySelectorAll('.home-catalogue h2')].map(x=>x.textContent),channelCount:document.querySelectorAll('.channel-rail a[href^="/channels/"]').length,heroBounds:rect(document.querySelector('.home-hero')),heroArt:rect(document.querySelector('.hero-artwork')),heroCopy:rect(document.querySelector('.hero-copy.is-active')),heroImageFit:getComputedStyle(document.querySelector('.hero-artwork-image img')).objectFit,pagination:rect(document.querySelector('.hero-pagination')),dotCenters:[...document.querySelectorAll('.hero-pagination button')].map(x=>{const r=x.getBoundingClientRect();return r.x+r.width/2}),heroSeeAll:document.querySelector('.home-hero')?.textContent.includes('See all')};
    })()`);
    assert.ok(metrics.documentWidth <= width, `${name} page overflow`);
    assert.equal(metrics.heroSeeAll, false, 'hero has no See all action');
    assert.ok(Math.abs(metrics.pagination.x + metrics.pagination.width / 2 - (metrics.heroBounds.x + metrics.heroBounds.width / 2)) < 2, `${name} pagination centered`);
    assert.ok(metrics.dotCenters.every((center, index) => index === 0 || center - metrics.dotCenters[index - 1] <= 31), `${name} pagination compact`);
    assert.equal(metrics.channelCount, 10);
    assert.deepEqual(metrics.titles, ["Channels", "New Releases", "Movies", "TV Shows", "Documentaries", "Animations"]);
    if (width >= 1024) { assert.ok(Math.abs(metrics.heroArt.x / width - .35) < .01); assert.ok(Math.abs(metrics.heroArt.width / width - .65) < .01); assert.equal(metrics.heroImageFit, 'cover'); assert.ok(metrics.heroCopy.x + metrics.heroCopy.width <= metrics.heroArt.x); }
    assert.ok(metrics.logo.x + metrics.logo.width <= metrics.search.x, "Header logo and controls do not overlap");
    assert.ok(metrics.logo.width > metrics.signIn.width, "Brand is larger than sign in");
    await screenshot(`${name}-home`);
    if (name === 'desktop-1440') {
      await waitFor("document.querySelector('.hero-trailer video')?.readyState >= 2 && !document.querySelector('.hero-trailer video')?.paused", 12000);
      await waitFor("getComputedStyle(document.querySelector('.hero-trailer')).opacity === '1'");
      await screenshot('desktop-1440-trailer');
      assert.deepEqual(await evaluate("(() => { const r = document.querySelector('.hero-artwork').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()"), metrics.heroArt);
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.hero-shade-horizontal')).zIndex"), '2');
      assert.equal(await evaluate("document.querySelector('.hero-trailer video').muted"), true, 'trailer starts muted');
      const soundStart = await evaluate("(() => { const video = document.querySelector('.hero-trailer video'); video.dataset.soundProbe = 'same-element'; window.__oldHeroVideo = video; return video.currentTime; })()");
      await evaluate("document.querySelector('.hero-audio-control').click()");
      assert.equal(await evaluate("document.querySelector('.hero-trailer video').muted"), false, 'sound control unmutes direct video');
      assert.equal(await evaluate("document.querySelector('.hero-trailer video').dataset.soundProbe"), 'same-element', 'sound toggle keeps the video element');
      await waitFor(`document.querySelector('.hero-trailer video')?.currentTime > ${soundStart + .3}`);
      const beforePause = await evaluate("(() => { const video = document.querySelector('.hero-trailer video'); video.dataset.pauseProbe = 'same-element'; return video.currentTime; })()");
      await evaluate("document.querySelector('.hero-playback-control').click()");
      await delay(1300);
      const duringPause = await evaluate("document.querySelector('.hero-trailer video').currentTime");
      assert.ok(Math.abs(duringPause - beforePause) < .25, 'pause preserves video position');
      await evaluate("document.querySelector('.hero-playback-control').click()");
      await waitFor(`document.querySelector('.hero-trailer video')?.currentTime > ${duringPause + .5}`);
      assert.equal(await evaluate("document.querySelector('.hero-trailer video').dataset.pauseProbe"), 'same-element');
      await delay(1800);
      assert.equal(await evaluate("document.querySelector('.hero-copy.is-active .hero-title').textContent"), 'River Journey 1');
      await waitFor("document.querySelector('.hero-copy.is-active .hero-title')?.textContent === 'River Journey 2'", 7000);
      assert.ok(await evaluate("window.__oldHeroVideo.paused && !window.__oldHeroVideo.isConnected"), 'previous trailer stops when featured item changes');
      await waitFor("document.querySelector('.hero-media-slide.is-active img')?.naturalWidth > 0");
      assert.ok((await evaluate("document.querySelector('.hero-media-slide.is-active img').currentSrc")).includes('cbmtvwhitelogo'), 'broken artwork uses fallback');
      assert.ok((await evaluate("document.querySelector('.hero-copy.is-active a.hero-primary-action').getAttribute('href')")).includes('/programs/2?play=1'));
      await delay(5500);
      assert.equal(await evaluate("document.querySelector('.hero-copy.is-active .hero-title').textContent"), 'River Journey 2');
      assert.equal(await evaluate("Boolean(document.querySelector('.hero-trailer'))"), false, 'failed video returns to artwork');
      await evaluate("document.querySelector('.hero-slide-next').click()");
      await waitFor("document.querySelector('.hero-copy.is-active .hero-title')?.textContent === 'River Journey 3'");
      await delay(100);
      const fadingCopy = await evaluate("(() => { const copies=[...document.querySelectorAll('.hero-stage .hero-copy')]; return { outgoing: Number(getComputedStyle(copies[1]).opacity), incoming: Number(getComputedStyle(copies[2]).opacity), positions: copies.map(x => x.getBoundingClientRect().x) }; })()");
      assert.ok(fadingCopy.outgoing > 0 && fadingCopy.incoming < 1, 'copy layers crossfade');
      assert.ok(fadingCopy.positions.every(x => x === fadingCopy.positions[0]), 'copy stays in place');
      await evaluate("document.querySelector('.hero-slide-prev').click()");
      await waitFor("document.querySelector('.hero-copy.is-active .hero-title')?.textContent === 'River Journey 2'");
      await evaluate(`(() => {
        window.__heroYT = { creates: 0, plays: 0, pauses: 0, mutes: 0, unmutes: 0 };
        window.YT = { Player: class {
          constructor(target, options) {
            window.__heroYT.creates++;
            window.__heroYT.videoId = options.videoId;
            this.options = options;
            target.replaceWith(document.createElement('iframe'));
            setTimeout(() => options.events.onReady(), 0);
          }
          mute() { window.__heroYT.mutes++; }
          unMute() { window.__heroYT.unmutes++; }
          playVideo() { window.__heroYT.plays++; this.options.events.onStateChange({ data: 1 }); }
          pauseVideo() { window.__heroYT.pauses++; this.options.events.onStateChange({ data: 2 }); }
          destroy() {}
        } };
      })()`);
      await evaluate("document.querySelectorAll('.hero-pagination button')[3].click()");
      await waitFor("document.querySelector('.hero-copy.is-active .hero-title')?.textContent === 'City Stories 1'");
      await waitFor("document.querySelector('.hero-trailer iframe')", 8000);
      assert.equal(await evaluate("window.__heroYT.videoId"), 'dQw4w9WgXcQ', 'active item supplies its own trailer');
      assert.ok(await evaluate("window.__heroYT.unmutes > 0"), 'sound preference carries to YouTube');
      const playsBeforeSound = await evaluate("window.__heroYT.plays");
      await evaluate("document.querySelector('.hero-audio-control').click()");
      assert.ok(await evaluate("window.__heroYT.mutes > 0"), 'YouTube sound control mutes');
      assert.equal(await evaluate("window.__heroYT.plays"), playsBeforeSound, 'YouTube sound toggle does not restart playback');
      await evaluate("document.querySelector('.hero-audio-control').click()");
      assert.ok(await evaluate("window.__heroYT.unmutes > 1"), 'YouTube sound control unmutes');
      await evaluate("document.querySelector('.hero-playback-control').click()");
      await delay(250);
      assert.ok(await evaluate("window.__heroYT.pauses > 0"), 'YouTube player pauses');
      await evaluate("document.querySelector('.hero-playback-control').click()");
      await delay(250);
      assert.ok(await evaluate("window.__heroYT.plays >= 2"), 'YouTube player resumes');
      assert.equal(await evaluate("window.__heroYT.creates"), 1, 'YouTube iframe is not recreated on resume');
      console.log('Hero geometry, gradient, pause/resume, timed and manual navigation, copy fade, and media fallbacks passed');
    }
    await evaluate("document.querySelector('footer').scrollIntoView({block:'end'})");
    await waitFor("document.querySelector('footer img')?.naturalWidth > 0");
    await delay(300);
    await screenshot(`${name}-footer`);
    measurements.push({ name, ...metrics });
    console.log(`${name}: homepage order, overflow, brand passed`);
  }
  await fetch('http://127.0.0.1:8001/__fixture/hero-mode?value=thumbnails_only');
  await navigate('/');
  await waitFor("document.querySelector('.hero-copy.is-active .hero-title')?.textContent === 'River Journey 1'");
  await delay(5500);
  assert.equal(await evaluate("Boolean(document.querySelector('.hero-trailer'))"), false, 'thumbnails-only mode suppresses trailer');
  await fetch('http://127.0.0.1:8001/__fixture/hero-mode?value=thumbnail_trailer');
  console.log('Thumbnails-only mode passed');
  await writeFile(`${artifacts}/measurements.json`, JSON.stringify(measurements,null,2));
} catch (error) {
  if (socket?.readyState === WebSocket.OPEN) { console.log(await evaluate("({url:location.href,text:document.body.innerText.slice(0,500)})")); await screenshot("failure"); }
  throw error;
} finally { closing = true; socket?.close(); browser.kill(); browser.unref(); }
