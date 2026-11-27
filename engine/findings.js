import "../settings.js";
import { MAX_ISSUES } from "./limits.js";
import { germanAgreement } from "./german-agreement.js";
import { germanCorrections } from "./german.js";
import { germanPunctuation } from "./punctuation.js";

const broaderRules = new Map([
  ["PRAEP_DAT", "DE_PRAEPOSITION_KASUS"], ["PRAEP_AKK", "DE_PRAEPOSITION_KASUS"],
  ["SUBJECT_VERB_AGREEMENT", "DE_SUBJEKT_VERB"]
]);

// Multiple rules may suggest the same edit with different surrounding context.
function editKey(issue, replacement) {
  const original = issue.original;
  let prefix = 0;
  while (prefix < original.length && original[prefix] === replacement[prefix]) prefix++;
  let end = original.length;
  let replacementEnd = replacement.length;
  while (end > prefix && replacementEnd > prefix && original[end - 1] === replacement[replacementEnd - 1]) {
    end--;
    replacementEnd--;
  }
  return JSON.stringify([issue.start + prefix, issue.start + end, replacement.slice(prefix, replacementEnd)]);
}

export function finishIssues(text, language, base, ignored, dictionary, styleHints, lexicon = null) {
  const accepted = new Set(dictionary.map(LGPSettings.wordKey));
  const extra = language === "de" ? [...germanCorrections(text), ...germanPunctuation(text, lexicon)] : [];
  if (lexicon && language === "de") extra.push(...germanAgreement(text, lexicon));
  const byEdit = new Map();
  for (const issue of extra) {
    const key = editKey(issue, issue.suggestions[0]);
    if (!byEdit.has(key)) byEdit.set(key, issue);
  }
  const visible = issue => !ignored.has(issue.id) && (styleHints || issue.kind !== "style")
    && (issue.kind !== "spelling" || !accepted.has(LGPSettings.wordKey(issue.original)));
  const local = [...byEdit.values()].filter(issue => visible(issue)
    && !(ignored.has("DE_KOMMA_DASS") && issue.id === "DE_KOMMA_NEBENSATZ"
      && /^[ \t]+dass\b/iu.test(text.slice(issue.start)))
    && !(issue.kind === "spelling" && ignored.has("GERMAN_SPELLER_RULE")));
  const bySpan = new Map([...byEdit.values()].map(issue => [`${issue.start}:${issue.end}`, issue]));
  const issues = [...local];
  for (const issue of base) {
    if (!visible(issue)) continue;
    if (issue.suggestions.some(value => {
      const preferred = byEdit.get(editKey(issue, value));
      return preferred && (preferred.start !== issue.start || preferred.end !== issue.end);
    })) continue;
    const specificRule = broaderRules.get(issue.id);
    if (specificRule && extra.some(item => item.id === specificRule
        && item.start < issue.end && issue.start < item.end)) continue;
    if (language === "de" && issue.id === "IM_IHM_SPELLING_RULE"
        && extra.some(item => item.id === "DE_ORT_NOMEN"
          && /^[ \t]+$/u.test(text.slice(issue.end, item.start)))) continue;
    const preferred = bySpan.get(`${issue.start}:${issue.end}`);
    if (preferred && (issue.kind === "spelling" || issue.suggestions.includes(preferred.suggestions[0]))) {
      preferred.suggestions = [...new Set([...preferred.suggestions, ...issue.suggestions])].slice(0, 8);
      continue;
    }
    // The speller sometimes treats an inline list separator and its next noun
    // as a broken compound, e.g. “- logo” → “-logo”.
    if (language === "de" && issue.kind === "spelling" && /^-[ \t]+\p{L}+$/u.test(issue.original)
        && issue.suggestions[0] === issue.original.replace(/[ \t]/gu, "")
        && /\p{L}[ \t]$/u.test(text.slice(0, issue.start))) continue;
    issues.push(issue);
  }
  return issues.sort((a, b) => a.start - b.start || a.end - b.end).slice(0, MAX_ISSUES);
}
