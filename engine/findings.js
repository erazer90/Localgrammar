import "../settings.js";
import { MAX_ISSUES } from "./limits.js";
import { germanCorrections } from "./german.js";
import { germanPunctuation } from "./punctuation.js";

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

export function finishIssues(text, language, base, ignored, dictionary, styleHints) {
  const accepted = new Set(dictionary.map(LGPSettings.wordKey));
  const extra = language === "de" ? [...germanCorrections(text), ...germanPunctuation(text)] : [];
  const localPunctuation = new Set(extra.filter(issue => issue.id.startsWith("DE_KOMMA_")
    || issue.id.startsWith("DE_SATZZEICHEN_")).map(issue => editKey(issue, issue.suggestions[0])));
  const visible = issue => !ignored.has(issue.id) && (styleHints || issue.kind !== "style")
    && (issue.kind !== "spelling" || !accepted.has(LGPSettings.wordKey(issue.original)));
  const local = extra.filter(issue => visible(issue)
    && !(ignored.has("DE_KOMMA_DASS") && issue.id === "DE_KOMMA_NEBENSATZ"
      && /^[ \t]+dass\b/iu.test(text.slice(issue.start)))
    && !(issue.kind === "spelling" && ignored.has("GERMAN_SPELLER_RULE")));
  const bySpan = new Map(extra.map(issue => [`${issue.start}:${issue.end}`, issue]));
  const issues = [...local];
  for (const issue of base) {
    if (!visible(issue)) continue;
    if (issue.suggestions.some(value => localPunctuation.has(editKey(issue, value)))) continue;
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
