// Run with ffmpeg on PATH, the fixture API on :8001, and next start on :3010.
// Screenshots and measurements are saved under .next/ui-corrections.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const artifacts = resolve(".next/ui-corrections");
await mkdir(artifacts, { recursive: true });
if (!existsSync(`${artifacts}/sample.mp4`)) {
  const media = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=0x123d39:s=640x360:r=10", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "60", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", `${artifacts}/sample.mp4`], { windowsHide: true });
  assert.equal(media.status, 0, "ffmpeg must generate the local playback fixture");
}
const browser = spawn(process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--autoplay-policy=no-user-gesture-required", "--remote-debugging-port=9335", `--user-data-dir=${artifacts}/chrome`, "about:blank"], { stdio: "ignore", windowsHide: true });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket, nextId = 0;
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
async function click(selector) {
  const point = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
}
async function key(key, code, windowsVirtualKeyCode) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode, ...(key === "Enter" ? {text:"\r",unmodifiedText:"\r"} : {}) });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode });
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
  socket.onclose = () => { for (const p of pending.values()) p.reject(new Error("Chrome DevTools connection closed")); pending.clear(); };
  await send("Page.enable"); await send("Runtime.enable");
  await navigate("/");
  await evaluate("localStorage.clear()");
  for (const [name, width, height] of [["mobile-320",320,740], ["mobile-390",390,844], ["tablet-768",768,1024], ["desktop-1440",1440,1000]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await navigate("/");
    await waitFor("document.querySelectorAll('.channel-card').length === 10 && document.querySelector('.channel-card img')?.naturalWidth > 0");
    const metrics = await evaluate(`(() => {
      const rect = el => { const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}; };
      return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,card:rect(document.querySelector('.channel-card')),art:rect(document.querySelector('.channel-card img')),logo:rect(document.querySelector('header img')),signIn:rect(document.querySelector('header a[href="/sign-in"]')),search:rect(document.querySelector('button[aria-label="Search catalogue"]')),titles:[...document.querySelectorAll('.home-catalogue h2')].map(x=>x.textContent),src:document.querySelector('.channel-card img').getAttribute('src'),seeAll:!!document.querySelector('section[aria-label="Channels"] a[href="/channels"]')};
    })()`);
    assert.ok(metrics.documentWidth <= width, `${name} page overflow`);
    assert.equal(metrics.seeAll, false);
    assert.deepEqual(metrics.titles, ["Channels", "New Releases", "TV Shows", "Movies", "Series", "Animations", "Documentaries"]);
    assert.ok(metrics.art.width >= 160 && metrics.card.width - metrics.art.width === 16);
    assert.ok(metrics.src.includes("channel1.png"), "Uses API cover artwork");
    assert.ok(metrics.logo.x + metrics.logo.width <= metrics.search.x, "Header logo and controls do not overlap");
    assert.ok(metrics.logo.width > metrics.signIn.width, "Brand is larger than sign in");
    await click('button[aria-label="Scroll channels right"]');
    await waitFor("document.querySelector('.channel-rail').scrollLeft > 100");
    await delay(600);
    await click('button[aria-label="Scroll channels left"]');
    await waitFor("document.querySelector('.channel-rail').scrollLeft < 5");
    if (width < 768) {
      await send("Emulation.setTouchEmulationEnabled", { enabled: true });
      const point = await evaluate("(() => {const r=document.querySelector('.channel-rail').getBoundingClientRect();return {x:r.x+r.width-20,y:r.y+80};})()");
      await send("Input.dispatchTouchEvent", { type:"touchStart",touchPoints:[point] });
      for(let i=1;i<=8;i++) { await send("Input.dispatchTouchEvent", {type:"touchMove",touchPoints:[{x:point.x-i*24,y:point.y}]}); await delay(25); }
      await send("Input.dispatchTouchEvent", {type:"touchEnd",touchPoints:[]});
      await waitFor("document.querySelector('.channel-rail').scrollLeft > 50");
      await evaluate("document.querySelector('.channel-rail').scrollLeft = 0");
    }
    await screenshot(`${name}-home`);
    await evaluate("document.querySelector('footer').scrollIntoView({block:'end'})");
    await waitFor("document.querySelector('footer img')?.naturalWidth > 0");
    await delay(300);
    await screenshot(`${name}-footer`);
    measurements.push({ name, ...metrics });
    console.log(`${name}: cards, artwork, order, arrows, overflow, brand passed`);
  }
  for (const [name,width,height] of [["mobile",390,844],["tablet",768,1024],["desktop",1440,1000]]) {
    await send("Emulation.setDeviceMetricsOverride", {width,height,deviceScaleFactor:1,mobile:width<768});
    await navigate("/programs/1");
    await waitFor("document.querySelector('video')?.currentTime > 0");
    assert.equal(await evaluate("document.querySelector('.player-options').textContent.trim()"), "", "No floating cinema label");
    await send("Input.dispatchMouseEvent", {type:"mouseMoved",x:10,y:10});
    await waitFor("getComputedStyle(document.querySelector('.player-options')).opacity === '0'", 6000);
    await evaluate("document.querySelector('video').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
    await waitFor("getComputedStyle(document.querySelector('.player-options')).opacity === '1'");
    await click('button[aria-label="Player options"]');
    await waitFor("document.querySelector('button[aria-pressed]')");
    await delay(2800);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.player-options')).opacity"), "1", "Open options stay visible");
    await screenshot(`${name}-options`);
    await click('button[aria-pressed]');
    await waitFor("document.querySelector('.watch-layout').dataset.playerMode === 'theater'");
    const time = await evaluate("document.querySelector('video').currentTime");
    assert.ok(time > 0, "Cinema toggle preserves playback");
    await screenshot(`${name}-cinema`);
    await click('button[aria-label="Enter fullscreen"]');
    await waitFor("document.fullscreenElement?.classList.contains('player-band')");
    // Popover remains inside the fullscreen element and can leave cinema there.
    await click('button[aria-label="Player options"]');
    await waitFor("document.fullscreenElement.contains(document.querySelector('button[aria-pressed]'))");
    await click('button[aria-pressed]');
    await waitFor("document.querySelector('.watch-layout').dataset.playerMode === 'standard'");
    await click('button[aria-label="Exit fullscreen"]');
    await waitFor("!document.fullscreenElement");
    await evaluate("document.querySelector('video').pause()");
    await delay(2800);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.player-options')).opacity"), "1", "Paused controls remain visible");
    await evaluate("document.querySelector('button[aria-label=\"Player options\"]').focus()");
    await key("Enter","Enter",13);
    await waitFor("document.querySelector('button[aria-pressed]')");
    assert.equal(await evaluate("document.activeElement?.matches('button[aria-pressed]')"), true, "Options receive keyboard focus");
    await key("Escape","Escape",27);
    await waitFor("document.activeElement?.getAttribute('aria-label') === 'Player options'");
    await screenshot(`${name}-player`);
    console.log(`${name}: playback, inactivity, cinema, fullscreen, keyboard passed`);
  }
  await navigate("/");
  await click('button[aria-label="Search catalogue"]');
  await waitFor("document.querySelector('input[aria-label=\"Search titles or genres\"]')");
  await send("Input.insertText",{text:"River"});
  await waitFor("document.querySelectorAll('li[role=option]').length > 0");
  await key("ArrowDown","ArrowDown",40); await key("Enter","Enter",13);
  await waitFor("location.pathname.startsWith('/programs/') && document.querySelector('.watch-layout')");
  await navigate("/sign-in?returnTo=%2Fprograms%2F1%3Fplay%3D1");
  await waitFor("document.querySelector('input[name=email]')");
  await evaluate("document.querySelector('input[name=email]').focus()"); await send("Input.insertText",{text:"viewer@example.test"});
  await evaluate("document.querySelector('input[name=password]').focus()"); await send("Input.insertText",{text:"fixture-only"});
  await click('button[type=submit]');
  await waitFor("location.pathname === '/programs/1'");
  await navigate("/");
  await evaluate("document.querySelector('.channel-card').click()");
  await waitFor("location.pathname === '/channels/1' && document.body.innerText.includes('CBM Music')");
  console.log("Search, sign-in return, and channel navigation passed");
  await writeFile(`${artifacts}/measurements.json`, JSON.stringify(measurements,null,2));
} catch (error) {
  if (socket?.readyState === WebSocket.OPEN) { console.log(await evaluate("({url:location.href,text:document.body.innerText.slice(0,500)})")); await screenshot("failure"); }
  throw error;
} finally { socket?.close(); browser.kill(); }
