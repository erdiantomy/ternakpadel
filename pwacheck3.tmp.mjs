import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto("http://localhost:4174/", { waitUntil: "load" });
await page.evaluate(() => navigator.serviceWorker.ready);
// second visit: SW now controls the page, assets get runtime-cached
await page.goto("http://localhost:4174/", { waitUntil: "load" });
await page.waitForTimeout(1200);
await ctx.setOffline(true);
try {
  const resp = await page.goto("http://localhost:4174/", { waitUntil: "load", timeout: 10000 });
  const ok = await page.evaluate(() => !!document.getElementById("root") && document.body.innerText.length > 0);
  console.log("offline navigation:", resp?.status(), "| app renders offline:", ok);
} catch (e) {
  console.log("offline navigation failed:", e.message.split("\n")[0]);
}
await browser.close();
