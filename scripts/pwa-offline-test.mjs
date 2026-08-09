// Definitive PWA offline test via Chrome DevTools Protocol.
// 1) load the app online so the SW installs and controls the page
// 2) emulate an offline network AND kill the real preview server
// 3) reload — the Home page must render purely from the SW precache
import { execFileSync } from "node:child_process";
const fs = await import("node:fs");

const CDP = "http://127.0.0.1:9222";
const URL = "http://127.0.0.1:5176/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tab = await (
  await fetch(CDP + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" })
).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const i = ++id;
    pending.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result);
    pending.delete(m.id);
  }
};
await new Promise((r) => (ws.onopen = r));
await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");

const evaluate = async (expr) => {
  const r = await send("Runtime.evaluate", {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  return r?.result?.value;
};

// 1) online load
await send("Page.navigate", { url: URL });
await sleep(9000);
const controlled = await evaluate(
  "!!navigator.serviceWorker && !!navigator.serviceWorker.controller"
);
console.log("online: controlled =", controlled);
if (!controlled) {
  console.log("FAIL: service worker never took control");
  process.exit(1);
}

// 2) go offline (CDP) AND kill the real server
await send("Network.emulateNetworkConditions", {
  offline: true,
  latency: 0,
  downloadThroughput: 0,
  uploadThroughput: 0,
});
let pid = "";
try {
  const out = execFileSync("netstat", ["-ano"]).toString();
  const line = out.split("\n").find((l) => l.includes(":5176") && l.includes("LISTEN"));
  pid = line?.trim().split(/\s+/).pop() ?? "";
} catch {
  /* ignore */
}
if (pid) {
  try {
    execFileSync("taskkill", ["/PID", pid, "/F"], { stdio: "ignore" });
    console.log("server pid", pid, "killed");
  } catch {
    /* already dead */
  }
}
await sleep(1500);

// 3) reload — must come from the SW
await send("Page.reload", { ignoreCache: true });
await sleep(8000);

const onlineStatus = await evaluate("navigator.onLine");
const href = await evaluate("location.href");
const text = (await evaluate("document.body && document.body.innerText")) || "";
const hasHome = text.includes("هوش مصنوعی را یاد بگیر");
const hasNotFound = text.includes("صفحه پیدا نشد");
const hasShell = text.includes("ورود") || text.includes("شروع یادگیری");
const shot = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync("C:/tmp/offline-cdp2.png", Buffer.from(shot.data, "base64"));
console.log("offline: href =", href);

console.log("offline: navigator.onLine =", onlineStatus);
console.log("offline: app shell rendered =", hasShell);
console.log("offline: HOME rendered =", hasHome, "| 404 =", hasNotFound);
console.log("offline: sample =", text.split("\n").slice(0, 3).join(" | "));
console.log(hasHome ? "PASS — offline works from SW precache" : "FAIL");
ws.close();
process.exit(0);
