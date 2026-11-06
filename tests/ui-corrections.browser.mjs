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
    const metrics = await evaluate(`(() => {
      const rect = el => { const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}; };
      return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,logo:rect(document.querySelector('header img')),signIn:rect(document.querySelector('header a[href="/sign-in"]')),search:rect(document.querySelector('button[aria-label="Search catalogue"]')),titles:[...document.querySelectorAll('.home-catalogue h2')].map(x=>x.textContent),featuredChannels:!!document.querySelector('section[aria-label="Featured Channels"]'),channelCount:document.querySelectorAll('.channel-rail a[href^="/channels/"]').length,heroArt:rect(document.querySelector('.hero-artwork')),heroCopy:rect(document.querySelector('.hero-copy')),heroImageFit:getComputedStyle(document.querySelector('.hero-artwork-image img')).objectFit,infoRadius:getComputedStyle(document.querySelector('.hero-info-action')).borderRadius};
    })()`);
    assert.ok(metrics.documentWidth <= width, `${name} page overflow`);
    assert.equal(metrics.featuredChannels, false);
    assert.equal(metrics.channelCount, 10);
    assert.deepEqual(metrics.titles, ["Channels", "New Releases", "Movies", "TV Shows", "Documentaries", "Animations"]);
    if (width >= 1024) { assert.ok(metrics.heroArt.x >= width * .4 && metrics.heroArt.x <= width * .44); assert.equal(metrics.heroImageFit, 'contain'); assert.equal(metrics.infoRadius, '0px'); }
    assert.ok(metrics.logo.x + metrics.logo.width <= metrics.search.x, "Header logo and controls do not overlap");
    assert.ok(metrics.logo.width > metrics.signIn.width, "Brand is larger than sign in");
    await screenshot(`${name}-home`);
    if (name === 'desktop-1440') {
      await waitFor("document.querySelector('.hero-trailer video')?.readyState >= 2 && !document.querySelector('.hero-trailer video')?.paused", 12000);
      await waitFor("getComputedStyle(document.querySelector('.hero-trailer')).opacity === '1'");
      assert.deepEqual(await evaluate("(() => { const r = document.querySelector('.hero-artwork').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()"), metrics.heroArt);
      console.log('Hero trailer playback and stable media region passed');
    }
    await evaluate("document.querySelector('footer').scrollIntoView({block:'end'})");
    await waitFor("document.querySelector('footer img')?.naturalWidth > 0");
    await delay(300);
    await screenshot(`${name}-footer`);
    measurements.push({ name, ...metrics });
    console.log(`${name}: homepage order, overflow, brand passed`);
  }
  await navigate("/channels");
  await waitFor("document.querySelector('a[href=\"/channels/1\"]')");
  await evaluate("document.querySelector('a[href=\"/channels/1\"]').click()");
  await waitFor("location.pathname === '/channels/1' && document.body.innerText.includes('CBM Music')");
  console.log("Channel directory and channel navigation passed");
  await writeFile(`${artifacts}/measurements.json`, JSON.stringify(measurements,null,2));
} catch (error) {
  if (socket?.readyState === WebSocket.OPEN) { console.log(await evaluate("({url:location.href,text:document.body.innerText.slice(0,500)})")); await screenshot("failure"); }
  throw error;
} finally { closing = true; socket?.close(); browser.kill(); browser.unref(); }
