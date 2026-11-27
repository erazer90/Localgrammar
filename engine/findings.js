import "../settings.js";
import { MAX_ISSUES } from "./limits.js";
import { germanCorrections } from "./german.js";

export function finishIssues(text, language, base, ignored, dictionary, styleHints) {
  const accepted = new Set(dictionary.map(LGPSettings.wordKey));
  const extra = language === "de" ? germanCorrections(text) : [];
  const visible = issue => !ignored.has(issue.id) && (styleHints || issue.kind !== "style")
    && (issue.kind !== "spelling" || !accepted.has(LGPSettings.wordKey(issue.original)));
  const local = extra.filter(issue => visible(issue)
    && !(issue.kind === "spelling" && ignored.has("GERMAN_SPELLER_RULE")));
  const bySpan = new Map(extra.map(issue => [`${issue.start}:${issue.end}`, issue]));
  const issues = [...local];
  for (const issue of base) {
    if (!visible(issue)) continue;
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
