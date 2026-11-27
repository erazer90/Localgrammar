import { finishIssues } from "./findings.js";
import { germanLexicon } from "./german-lexicon.js";
import { rankSpelling } from "./spelling.js";
import { normalizeText } from "./text.js";
import { limitText } from "./limits.js";
import { fallbackLanguage } from "./fallback.js";
import init, { detect_json, LtEngine } from "./vendor/lt_wasm.js";

const variants = { de: "de-DE", en: "en-US", "en-GB": "en-GB" };
const cache = new Map();
const previousRuleIds = new Map([
  ["DAS_DASS", ["RELATIVPRONOMEN_STATT_DASS"]],
  ["SEIT_SEID", ["SEIT_VS_SEID", "SEID_VS_SEIT"]],
  ["A_AN", ["EN_A_VS_AN"]],
  ["DOUBLE_SPACE", ["DOPPELTES_LEERZEICHEN", "WHITESPACE_RULE"]]
]);
let ready;

function initWasm() {
  ready ??= init().catch(error => {
    ready = undefined;
    throw error;
  });
  return ready;
}

async function loadEngine(language, day) {
  const base = language === "de" ? "de" : "en";
  const url = new URL(`./vendor/packs/${base}.pack.gz`, import.meta.url);
  const response = await fetch(url);
  if (!response.ok) throw new Error("Missing local language data");
  const bytes = new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
  let lexicon = null;
  if (language === "de") {
    try {
      lexicon = germanLexicon(bytes);
    } catch (error) {
      console.warn("German morphology data could not be loaded.", error);
    }
  }
  const engine = new LtEngine(variants[language], bytes, JSON.stringify({ today: day, variant: variants[language] }));
  return { engine, lexicon, day };
}

async function getEngine(language) {
  const day = new Date().toLocaleDateString("sv-SE");
  const cached = cache.get(language);
  if (cached?.day === day) {
    cache.delete(language);
    cache.set(language, cached);
    return cached;
  }
  if (cached) {
    cached.engine.free();
    cache.delete(language);
  }
  // The worker owns at most two compiled variants across all tabs.
  if (cache.size === 2) {
    const oldest = cache.keys().next().value;
    cache.get(oldest).engine.free();
    cache.delete(oldest);
  }
  const loaded = await loadEngine(language, day);
  cache.set(language, loaded);
  return loaded;
}

// LingoTweaker returns UTF-8 byte offsets, while DOM Range and JS use UTF-16.
function utf16Offsets(text) {
  const result = new Map([[0, 0]]);
  let bytes = 0;
  let units = 0;
  for (const char of text) {
    const cp = char.codePointAt(0);
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    units += char.length;
    result.set(bytes, units);
  }
  return result;
}

function selectLanguage(text, preference, hint) {
  if (preference !== "auto") return preference;
  const { resolved, candidates } = JSON.parse(detect_json(text));
  const [first, second] = candidates;
  const reliableShortText = first?.confidence >= 0.92 && (second?.confidence ?? 0) < 0.06
    && (text.match(/\p{L}+/gu) ?? []).length >= 3;
  const detected = resolved || (reliableShortText ? first.language : null);
  if (detected === "de" || detected?.startsWith("de-")) return "de";
  if (detected === "en" || detected?.startsWith("en-")) return /^en-GB\b/i.test(hint) ? "en-GB" : "en";
  return detected ? null : fallbackLanguage(text, preference, hint);
}

export async function checkWithWasm(value, preference, hint, dictionary, ignoredRules, styleHints = true) {
  const source = limitText(value);
  const { text, restore } = normalizeText(source);
  const result = { engine: "wasm", language: null, truncated: source.length < value.length, issues: [] };
  if (!text.trim()) return result;
  await initWasm();
  const language = selectLanguage(text, preference, hint);
  if (!language) return result;
  result.language = language;

  const { engine, lexicon } = await getEngine(language);
  const { matches } = JSON.parse(engine.check_matches_json(text));
  const offsets = utf16Offsets(text);
  const ignored = new Set(ignoredRules.flatMap(id => [id, ...(previousRuleIds.get(id) || [])]));
  const unique = new Set();

  for (const match of matches) {
    const { rule_id: id, specific_rule_id: specific, issue_type, match_type } = match;
    if (ignored.has(id) || (specific && ignored.has(specific))) continue;
    const start = offsets.get(match.range.start);
    const end = offsets.get(match.range.end);
    if (start === undefined || end === undefined || end < start) continue;
    const original = text.slice(start, end);
    const spelling = match_type === "UnknownWord";
    const kind = spelling ? "spelling" : id !== "UPPERCASE_SENTENCE_START" && /style|typograph/i.test(issue_type) ? "style" : "grammar";
    const suggestions = [...new Set(match.suggestions.map(fix => fix.value))]
      .filter(fix => fix !== original);
    const message = match.message.replace(/<\/?(?:suggestion|old|new|em|i|b|strong)>/giu, "");
    const key = JSON.stringify([id, start, end, message, suggestions]);
    if (unique.has(key)) continue;
    unique.add(key);
    result.issues.push({ id, start, end, original, message, kind,
      suggestions: (spelling && language === "de" ? rankSpelling(original, suggestions) : suggestions).slice(0, 8) });
  }
  result.issues = restore(finishIssues(text, language, result.issues, ignored, dictionary, styleHints, lexicon));
  return result;
}
