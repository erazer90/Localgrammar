import assert from "node:assert/strict";
import { test } from "node:test";
import { unzipSync, strFromU8 } from "fflate";
import { buildExtension, root, verifyExtension } from "../../scripts/extension.js";

test("release tags must match the version in manifest.json", async () => {
  await assert.rejects(verifyExtension(root, "v0.0.0"), /does not match manifest version/u);
});

test("installable ZIP is reproducible and contains only the extension tree", async () => {
  const first = await buildExtension();
  const second = await buildExtension();
  const archive = unzipSync(first.archive);
  const manifest = JSON.parse(strFromU8(archive["LocalGrammarPro/manifest.json"]));
  assert.equal(first.digest, second.digest);
  assert.equal(first.filename, `LocalGrammarPro-${manifest.version}.zip`);
  assert.ok(archive["LocalGrammarPro/engine/vendor/lt_wasm_bg.wasm"]);
  for (const language of ["de", "en"]) {
    assert.ok(archive[`LocalGrammarPro/engine/vendor/packs/${language}.pack.gz`]);
  }
  assert.equal(Object.keys(archive).some(path => /\/(?:\.github|\.git|node_modules|scripts|tests)\//u.test(path)), false);
});
