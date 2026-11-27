import assert from "node:assert/strict";
import { test } from "node:test";
import { fallbackCheck } from "../../engine/fallback.js";
import { limitText, MAX_ISSUES, MAX_TEXT } from "../../engine/limits.js";

test("German fallback finds contextual mistakes with UTF-16 spans", () => {
  const text = "🙂 Ich glaube, das du da bist. Seit ihr bereit?";
  const result = fallbackCheck(text, "de", "", []);
  assert.equal(result.engine, "fallback");
  assert.deepEqual(result.issues.map(({ id, start, end, suggestions }) => [id, text.slice(start, end), suggestions]), [
    ["DAS_DASS", "das", ["dass"]],
    ["SEIT_SEID", "Seit", ["Seid"]]
  ]);
  assert.equal(result.issues[0].start, text.indexOf("das"));
});

test("fallback leaves valid ambiguous words alone and respects ignored rules", () => {
  assert.deepEqual(fallbackCheck("Seit gestern seid ihr hier. Das war ein Mann.", "de", "", []).issues, []);
  assert.deepEqual(fallbackCheck("I have a university degree.", "en", "", []).issues, []);
  assert.deepEqual(fallbackCheck("It was a apple.", "en", "", ["A_AN"]).issues, []);
});

test("fallback returns at most the configured number of findings", () => {
  const result = fallbackCheck("It was a apple. ".repeat(MAX_ISSUES + 1), "en", "", []);
  assert.equal(result.issues.length, MAX_ISSUES);
  assert.equal(result.truncated, false);
});

test("text limits prefer sentence boundaries and preserve surrogate pairs", () => {
  const sentence = `${"a".repeat(MAX_TEXT - 10)}.`;
  assert.equal(limitText(`${sentence} ${"b".repeat(30)}`), sentence);
  assert.equal(limitText(`${"x".repeat(MAX_TEXT - 1)}🙂z`), "x".repeat(MAX_TEXT - 1));
  assert.equal(limitText("🙂 kurz"), "🙂 kurz");
});

test("local rules work with the fallback and leave correct expressions alone", () => {
  const result = fallbackCheck("Im vorraus: logo einbauen - einstellungen ändern", "de", "", []);
  assert.deepEqual(result.issues.map(issue => issue.suggestions[0]), ["Voraus", "Logo", "–", "Einstellungen"]);
  const list = fallbackCheck("fürcherlich aus - logo einbauen - einstellungen und features überarbeiten", "de", "", []);
  assert.deepEqual(list.issues.map(issue => issue.suggestions[0]), ["Fürchterlich", "–", "Logo", "–", "Einstellungen", "Features"]);
  assert.deepEqual(fallbackCheck("Im Voraus. Vor allem das Design gefällt mir. Wie geht’s dir?", "de", "", []).issues, []);
  assert.deepEqual(fallbackCheck("Fürcherlich", "de", "", [], ["fürcherlich"]).issues, []);
  assert.deepEqual(fallbackCheck("We use vorallem as a name.", "en", "", []).issues, []);
});

test("German punctuation and fixed phrases use context", () => {
  const text = "Ich hoffe dass das die selbe Frage ist. Vielen dank für deine Hilfe!";
  assert.deepEqual(fallbackCheck(text, "de", "", []).issues.map(issue => issue.suggestions[0]),
    [", dass", "dieselbe", "Dank"]);
  assert.deepEqual(fallbackCheck("Ich hoffe, dass das dieselbe Frage ist. Vielen Dank für deine Hilfe!", "de", "", []).issues, []);
});
