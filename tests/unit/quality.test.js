import assert from "node:assert/strict";
import { test } from "node:test";
import { parseM2 } from "../../scripts/quality/falko-merlin.js";
import { score } from "../../scripts/quality/scoring.js";

test("benchmark credits equivalent compact edits and counts each finding once", () => {
  const rows = [
    { id: "relative", text: "Der Mann der wartet", edits: [
      { start: 8, end: 8, replacements: [","], category: "punctuation" }
    ] },
    { id: "overlap", text: "The", edits: [
      { start: 0, end: 3, replacements: ["Der"], category: "spelling" },
      { start: 0, end: 3, replacements: ["Das"], category: "spelling" }
    ] },
    { id: "clean", text: "Das passt", edits: [] }
  ];
  const scores = score(rows, [
    [{ start: 4, end: 8, suggestions: ["Mann,"] }, { start: 8, end: 8, suggestions: [","] }],
    [{ start: 0, end: 3, suggestions: ["Das", "Der"] }],
    [{ start: 4, end: 9, suggestions: ["paßt"] }]
  ]);
  assert.equal(scores.found, 2);
  assert.equal(scores.first, 2);
  assert.equal(scores.findings, 3);
  assert.equal(scores.cleanFindings, 1);
  assert.equal(scores.cleanWords, 2);
});

test("M2 loader reconstructs German punctuation and uses one annotator", () => {
  const rows = parseM2("S Wir gehen weil es passt .\nA 2 2|||PUNCT|||,|||REQUIRED|||-NONE-|||0\n"
    + "A 1 2|||VERB|||laufen|||REQUIRED|||-NONE-|||1\n\nS Das passt .\nA -1 -1|||noop|||-NONE-|||REQUIRED|||-NONE-|||0\n");
  assert.equal(rows[0].text, "Wir gehen weil es passt.");
  assert.deepEqual(rows[0].edits, [{ start: 9, end: 9, replacements: [","], category: "Zeichensetzung" }]);
  assert.deepEqual(rows[1].edits, []);
});
