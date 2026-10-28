// Local, read-only fixture for the UI browser check. No production API is used.
import http from "node:http";
import { readFile } from "node:fs/promises";

const origin = "http://127.0.0.1:8001";
const channels = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1, name: `CBM ${["Music", "Movies", "Stories", "Kids", "Culture"][i % 5]}`,
  description: "Channel programming", cover_image_url: `/images/channel${i + 1}.png`,
  logo_url: "/images/cbmtvwhitelogo.png",
}));
const items = ["movie", "series", "documentary", "animations", "miniseries", "original"].flatMap((content_type, i) => Array.from({ length: 3 }, (_, j) => ({
  id: i * 10 + j + 1, title: `${["River Journey", "City Stories", "Beyond the Horizon", "Young Dreamers", "Short Season", "Our Story"][i]} ${j + 1}`,
  description: "Stories from our growing African catalogue.", content_type,
  thumbnail: `/images/program${(i + j) % 8 + 1}.png`, trailer_link: null,
  streaming_link: `${origin}/media/sample.mp4`, duration: "00:01:00", genre: "Drama",
  country: "Uganda", status: "approved", channel: j + 1,
  created_at: new Date(Date.UTC(2026, 9, 20 + j)).toISOString(), is_featured: i === 0 && j === 0,
})));
const list = (results) => ({ count: results.length, next: null, previous: null, results });
const user = { id: 1, name: "Test Viewer", email: "viewer@example.test" };
const send = (res, status, data) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return send(res, 204, {});
  const url = new URL(req.url, origin);
  if (url.pathname === "/media/sample.mp4") {
    const data = await readFile(new URL("../../.next/ui-corrections/sample.mp4", import.meta.url));
    res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": data.length });
    return res.end(data);
  }
  if (url.pathname === "/api/channels/") return send(res, 200, list(channels));
  if (/^\/api\/channels\/\d+\/$/.test(url.pathname)) return send(res, 200, channels.find((c) => c.id === Number(url.pathname.split("/")[3])));
  if (url.pathname === "/api/content/") return send(res, 200, list(items.filter((item) => (!url.searchParams.get("content_type") || item.content_type === url.searchParams.get("content_type")) && (!url.searchParams.get("featured") || item.is_featured))));
  if (/^\/api\/content\/\d+\/$/.test(url.pathname)) return send(res, 200, items.find((c) => c.id === Number(url.pathname.split("/")[3])));
  if (url.pathname === "/api/content/search/") {
    const q = url.searchParams.get("q")?.toLowerCase() || "";
    const hits = items.filter((item) => item.title.toLowerCase().includes(q));
    return send(res, 200, { query: q, count: hits.length, hits, source: "database" });
  }
  if (url.pathname === "/api/content/adverts/") return send(res, 200, [{ id: 1, advert_name: "River Journey", advert_link: "/programs/1", advert_thumbnail: items[0].thumbnail, show_in_hero: true }]);
  if (url.pathname === "/api/content/hero-settings/") return send(res, 200, { image_duration_seconds: 20 });
  if (url.pathname === "/api/accounts/profile/") return send(res, req.headers.authorization ? 200 : 401, req.headers.authorization ? user : {});
  if (url.pathname === "/api/accounts/login/") return send(res, 200, { user, access: "fixture-access", refresh: "fixture-refresh" });
  if (["/api/content/seasons/", "/api/content/episodes/", "/api/content/miniseries/"].includes(url.pathname)) return send(res, 200, list([]));
  return send(res, 404, { detail: "Fixture route absent" });
}).listen(8001, "127.0.0.1", () => console.log("UI fixture API on 8001"));
