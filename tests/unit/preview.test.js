import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const controller = await readFile(new URL("../../content/controller.js", import.meta.url), "utf8");

test("an initial preview is replaced by the full result and a late preview is discarded", async () => {
  for (const previewFirst of [true, false]) {
    const timers = new Map();
    const requests = new Map();
    const shown = [];
    const view = { text: "im park" };
    const editor = { isConnected: true };
    class Observer { observe() {} disconnect() {} }
    const events = { addEventListener() {} };
    const sandbox = {
      setTimeout(fn, delay) { timers.set(delay, fn); return delay; },
      clearTimeout(id) { timers.delete(id); },
      requestAnimationFrame(fn) { timers.set("draw", fn); return 1; },
      MutationObserver: Observer, ResizeObserver: Observer, window: events, document: events,
      location: { ancestorOrigins: [], origin: "https://example.org" },
      LGPMarks: class { clear() {} render(_editor, _view, issues) { shown.push(issues[0].id); } },
      LGPEditor: { focused: () => editor, editorFor: () => editor, snapshot: () => view,
        languageHint: () => "de", caretOffset: () => 0,
        checkSections: () => [{ ...view, start: 0, end: 7, offset: 0 }] },
      LGPSettings: { hostname: () => "example.org",
        read: async () => ({ enabled: true, showInline: true, pausedSites: [] }) },
      chrome: { storage: { onChanged: { addListener() {} } }, runtime: {
        sendMessage: ({ action }) => new Promise(resolve => requests.set(action, resolve))
      } }
    };
    runInNewContext(controller, sandbox);
    await new Promise(resolve => setImmediate(resolve));
    const check = timers.get(30)();
    const preview = timers.get(1500)();
    const result = engine => ({ engine, issues: [{ start: 3, end: 7, original: "park", id: engine }] });
    if (previewFirst) {
      requests.get("grammar.preview")(result("fallback"));
      await preview;
      timers.get("draw")();
    }
    requests.get("grammar.check")(result("wasm"));
    await check;
    timers.get("draw")();
    if (!previewFirst) {
      requests.get("grammar.preview")(result("fallback"));
      await preview;
    }
    assert.deepEqual(shown, previewFirst ? ["fallback", "wasm"] : ["wasm"]);
  }
});
