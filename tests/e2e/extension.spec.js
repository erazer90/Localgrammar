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
      return { x: (box.left + box.right) / 2, y: box.top + box.height / 3 };
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

test("private fields and excluded editor fragments never enter grammar requests", async () => {
  const page = await context.newPage();
  const worker = context.serviceWorkers()[0];
  await worker.evaluate(() => {
    const probe = { texts: [] };
    probe.listener = message => {
      if (message?.action === "grammar.check") probe.texts.push(message.text);
    };
    globalThis.privacyProbe = probe;
    chrome.runtime.onMessage.addListener(probe.listener);
  });
  const texts = () => worker.evaluate(() => globalThis.privacyProbe.texts);
  const clear = () => worker.evaluate(() => { globalThis.privacyProbe.texts = []; });
  try {
    await page.goto(origin);
    await page.locator("#plain").focus();
    await expect.poll(texts).toContain("🙂 Die Gramatik ist schwierig.");
    await expect(page.locator("local-grammar-pro")).toHaveCount(1);
    await page.evaluate(() => {
      const container = document.createElement("section");
      container.innerHTML = `
        <input id="otp" autocomplete="one-time-code" value="Testgeheimnis">
        <textarea id="private-text" autocomplete="current-password">Testgeheimnis</textarea>
        <div id="private-rich" contenteditable="true" autocomplete="cc-number">Testgeheimnis</div>
        <div data-local-grammar-ignore><textarea id="optout">Testgeheimnis</textarea></div>
        <div id="shadow-private" data-local-grammar-ignore></div>
        <div id="dynamic"><textarea id="dynamic-text">Die Gramatik ist schwierig.</textarea></div>
        <div id="partial" contenteditable="true">Die <span data-local-grammar-ignore>Testgeheimnis</span> Gramatik ist schwierig.</div>`;
      document.body.append(container);
      document.getElementById("shadow-private").attachShadow({ mode: "open" }).innerHTML =
        '<textarea id="shadow-text">Testgeheimnis</textarea>';
    });
    await clear();
    for (const selector of ["#password", "#otp", "#private-text", "#private-rich", "#optout", "#shadow-text"]) {
      await page.locator(selector).focus();
      // Wait beyond the 330 ms debounce to detect accidental background requests.
      await page.waitForTimeout(650);
      expect(await texts()).toEqual([]);
      await expect(page.locator("local-grammar-pro")).toHaveCount(0);
    }

    await page.locator("#dynamic-text").focus();
    await expect.poll(texts).toContain("Die Gramatik ist schwierig.");
    await expect(page.locator("local-grammar-pro")).toHaveCount(1);
    await clear();
    await page.locator("#dynamic").evaluate(element => element.setAttribute("data-local-grammar-ignore", ""));
    await page.locator("#dynamic-text").fill("Testgeheimnis");
    await page.waitForTimeout(650);
    expect(await texts()).toEqual([]);
    await expect(page.locator("local-grammar-pro")).toHaveCount(0);

    await page.locator("#partial").focus();
    await expect.poll(async () => (await texts()).length).toBeGreaterThan(0);
    expect((await texts()).every(text => !text.includes("Testgeheimnis"))).toBe(true);
    expect((await texts()).some(text => text.includes("Gramatik"))).toBe(true);
  } finally {
    await worker.evaluate(() => {
      chrome.runtime.onMessage.removeListener(globalThis.privacyProbe.listener);
      delete globalThis.privacyProbe;
    });
    await page.close();
  }
});

test("clicking adjacent words offers one undoable edit and respects grouping settings", async () => {
  const page = await context.newPage();
  const options = await context.newPage();
  try {
    await options.goto(`${extension}/ui/options.html`);
    await page.goto(origin);
    const editor = page.locator("#plain");
    const text = "Es ist vorallem fürcherlich. Danke!";
    await editor.fill(text);
    await expect(page.locator("local-grammar-pro")).toHaveCount(1);
    const point = await editor.evaluate(node => {
      const style = getComputedStyle(node);
      const canvas = document.createElement("canvas").getContext("2d");
      canvas.font = style.font;
      const bounds = node.getBoundingClientRect();
      return { x: bounds.x + node.clientLeft + parseFloat(style.paddingLeft) + canvas.measureText("Es ist vor").width,
        y: bounds.y + node.clientTop + parseFloat(style.paddingTop) + parseFloat(style.fontSize) / 2 };
    });
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 55, point.y, { steps: 5 });
    await page.mouse.up();
    await expect(editor).toBeFocused();
    expect(await editor.evaluate(node => node.selectionEnd - node.selectionStart)).toBeGreaterThan(0);
    await page.mouse.click(point.x, point.y);
    // Chromium exposes the closed extension shadow tree to the accessibility API.
    const session = await context.newCDPSession(page);
    const buttons = async () => (await session.send("Accessibility.getFullAXTree")).nodes
      .filter(node => node.role?.value === "button");
    const groupName = "vor allem fürchterlich";
    await expect.poll(async () => (await buttons()).map(node => node.name?.value)).toContain(groupName);
    const grouped = (await buttons()).find(node => node.name?.value === groupName);
    await session.send("DOM.focus", { backendNodeId: grouped.backendDOMNodeId });
    await page.keyboard.press("Enter");
    await expect(editor).toHaveValue("Es ist vor allem fürchterlich. Danke!");
    await page.keyboard.press("Control+z");
    await expect(editor).toHaveValue(text);

    await options.getByRole("switch", { name: /Vorschläge bündeln/u }).uncheck();
    await expect(options.getByRole("status")).toHaveText("Gespeichert.");
    await options.reload();
    await expect(options.locator("#groupSuggestions")).toBeEnabled();
    await expect(options.locator("#groupSuggestions")).not.toBeChecked();
    await page.bringToFront();
    await editor.focus();
    await expect(page.locator("local-grammar-pro")).toHaveCount(1);
    await page.mouse.click(point.x, point.y);
    await expect.poll(async () => (await buttons()).map(node => node.name?.value)).toContain("vor allem");
    expect((await buttons()).some(node => node.name?.value === groupName)).toBe(false);
    await session.detach();
  } finally {
    await options.locator("#groupSuggestions").check();
    await page.close();
    await options.close();
  }
});

test("marks settle after checking and popup stays usable", async () => {
  const page = await context.newPage();
  const popup = await context.newPage();
  try {
    await page.goto(origin);
    await page.locator("#plain").fill("Gestern war ich mit meinen Freunden im park.");
    await expect(page.locator("local-grammar-pro")).toHaveCount(1);
    const changes = await page.evaluate(async () => {
      let count = 0;
      const observer = new MutationObserver(() => count++);
      observer.observe(document.documentElement, { childList: true, subtree: true });
      await new Promise(resolve => setTimeout(resolve, 700));
      observer.disconnect();
      return count;
    });
    expect(changes).toBeLessThan(8);
    await popup.goto(`${extension}/ui/popup.html`);
    await expect(popup.locator("#enabled")).toBeEnabled();
    await popup.locator("#enabled").uncheck();
    await expect(page.locator("local-grammar-pro")).toHaveCount(0);
    await popup.locator("#enabled").check();
  } finally {
    await page.close();
    await popup.close();
  }
});
