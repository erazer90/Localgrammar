import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, test } from "@playwright/test";
import { root } from "../../scripts/extension.js";

const fixture = `<!doctype html>
<html lang="de">
<meta charset="utf-8">
<style>
  body { font: 20px/1.5 monospace; margin: 24px; }
  textarea, [contenteditable] { display: block; font: inherit; padding: 8px; width: 520px; }
</style>
<textarea id="plain" spellcheck="false">🙂 Die Gramatik ist schwierig.</textarea>
<div id="editor"></div>
<input id="password" type="password" value="Gramatik">
</html>`;

let server;
let profile;
let context;
let origin;
let extension;

test.beforeAll(async () => {
  server = createServer((_request, response) => {
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline';"
    });
    response.end(fixture);
  });
  await new Promise((ready, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", ready);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  profile = await mkdtemp(join(tmpdir(), "lgp-chromium-"));
  context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    args: [
      `--disable-extensions-except=${root}`, `--load-extension=${root}`,
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1", "--no-proxy-server"
    ]
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 15_000 });
  // WHATWG URL returns an opaque origin for chrome-extension URLs in Node.
  extension = `chrome-extension://${new URL(worker.url()).hostname}`;
});

test.afterAll(async () => {
  await context?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  if (profile) await rm(profile, { recursive: true, force: true });
});

test("the extension worker returns real WASM results without a network connection", async () => {
  const report = await context.newPage();
  try {
    await report.goto(`${extension}/ui/selection.html`);
    await context.setOffline(true);
    const result = await report.evaluate(() => chrome.runtime.sendMessage({
      action: "grammar.check", site: "127.0.0.1", text: "Ich habe gestern ein Film gesehen."
    }));
    expect(result.engine).toBe("wasm");
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ original: "ein Film", suggestions: expect.arrayContaining(["einen Film"]) })
    ]));
  } finally {
    await context.setOffline(false);
    await report.close();
  }
});

async function applyFirstSuggestion(page) {
  await expect(page.locator("local-grammar-pro")).toBeFocused();
  await page.keyboard.press("Tab"); // Close button
  await page.keyboard.press("Tab"); // First suggestion
  await page.keyboard.press("Enter");
}

test("the extension corrects textarea text and preserves formatting and undo in a dynamic editor", async () => {
  const page = await context.newPage();
  try {
    await page.goto(origin);
    const plain = page.locator("#plain");
    await plain.focus();
    await expect(page.locator("local-grammar-pro")).toHaveCount(1);
    await page.keyboard.press("Alt+Shift+g");
    await applyFirstSuggestion(page);
    await expect(plain).toHaveValue("🙂 Die Grammatik ist schwierig.");

    await page.locator("#editor").evaluate(element => {
      element.setAttribute("contenteditable", "true");
      element.innerHTML = "🙂 <b>Heute</b> ist die <em>Gramatik</em> wichtig.";
      element.focus();
    });
    const editor = page.locator("#editor");
    await expect(page.locator("local-grammar-pro")).toHaveCount(1);
    const { x, y } = await editor.locator("em").evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const box = range.getBoundingClientRect();
      return { x: (box.left + box.right) / 2, y: box.bottom - 3 };
    });
    await page.mouse.click(x, y);
    await applyFirstSuggestion(page);
    await expect(editor.locator("em")).toHaveText("Grammatik");
    await expect(editor.locator("b")).toHaveText("Heute");
    await page.keyboard.press("Control+z");
    await expect(editor.locator("em")).toHaveText("Gramatik");

    await page.locator("#password").focus();
    await expect(page.locator("local-grammar-pro")).toHaveCount(0);
  } finally {
    await page.close();
  }
});
