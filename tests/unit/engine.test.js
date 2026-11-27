import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";
import { checkWithWasm } from "../../engine/lingotweaker.js";

const fetchBefore = globalThis.fetch;
const allowedFiles = new Map([
  ["lt_wasm_bg.wasm", "application/wasm"],
  ["packs/de.pack.gz", "application/octet-stream"],
  ["packs/en.pack.gz", "application/octet-stream"]
].map(([path, type]) => [new URL(`../../engine/vendor/${path}`, import.meta.url).href, type]));

const requestedFiles = new Set();
globalThis.fetch = async input => {
  const url = new URL(input);
  const type = allowedFiles.get(url.href);
  assert.ok(type, `Unexpected engine request: ${url.href}`);
  requestedFiles.add(url.href);
  return new Response(await readFile(url), { headers: { "Content-Type": type } });
};
after(() => { globalThis.fetch = fetchBefore; });

test("bundled WASM checks German grammar and spelling after an emoji", async () => {
  const text = "Ich habe gestern ein Film gesehen. 🙂 Die Gramatik ist schwierig.";
  const result = await checkWithWasm(text, "de", "", [], []);
  const spelling = result.issues.find(item => item.original === "Gramatik");
  assert.equal(result.engine, "wasm");
  assert.equal(result.language, "de");
  assert.ok(result.issues.some(item => item.suggestions.includes("einen Film")));
  assert.ok(spelling.suggestions.includes("Grammatik"));
  assert.equal(spelling.start, text.indexOf("Gramatik"));
  assert.equal(text.slice(spelling.start, spelling.end), "Gramatik");

  const accepted = await checkWithWasm(text, "de", "", ["gramatik"], []);
  assert.equal(accepted.issues.some(item => item.original === "Gramatik"), false);
  assert.ok(accepted.issues.some(item => item.suggestions.includes("einen Film")));
});

test("bundled WASM checks English agreement and the British spelling variant", async () => {
  const american = await checkWithWasm("🙂 She go to school.", "auto", "", [], []);
  assert.equal(american.language, "en");
  assert.ok(american.issues.some(item => item.start === 7 && item.original === "go"
    && item.suggestions.includes("goes")));
  const british = await checkWithWasm("This colour is lovely. The color is nice.", "en-GB", "", [], []);
  assert.equal(british.language, "en-GB");
  assert.ok(british.issues.some(item => item.original === "color" && item.suggestions.includes("colour")));
  assert.equal(british.issues.some(item => item.original === "colour"), false);
  assert.deepEqual(requestedFiles, new Set(allowedFiles.keys()));
});
