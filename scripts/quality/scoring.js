export function minimalEdit(text, start, end, replacement) {
  const original = text.slice(start, end);
  let prefix = 0;
  while (prefix < original.length && original[prefix] === replacement[prefix]) prefix++;
  let suffix = 0;
  while (suffix < original.length - prefix && suffix < replacement.length - prefix
      && original.at(-1 - suffix) === replacement.at(-1 - suffix)) suffix++;
  return { start: start + prefix, end: end - suffix, replacement: replacement.slice(prefix, replacement.length - suffix) };
}

const key = ({ start, end, replacement }) => JSON.stringify([start, end, replacement]);

export function score(rows, predictions) {
  const totals = { texts: rows.length, words: 0, references: 0, found: 0, first: 0,
    correctlyLocated: 0, findings: 0, unmatched: 0, cleanWords: 0, cleanTexts: 0, cleanFindings: 0, cleanFlagged: 0 };
  const categories = Object.create(null);
  const missed = [];
  for (let index = 0; index < rows.length; index++) {
    const { id, text, edits } = rows[index];
    const words = text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
    const uniqueFindings = new Map();
    for (const issue of predictions[index]) {
      const alternatives = issue.suggestions.map(value => minimalEdit(text, issue.start, issue.end, value));
      const best = alternatives[0];
      const identity = best ? key(best) : `@${issue.start}:${issue.end}`;
      if (!uniqueFindings.has(identity)) uniqueFindings.set(identity, { issue, alternatives });
    }
    const findings = [...uniqueFindings.values()];
    totals.words += words;
    totals.findings += findings.length;
    if (!edits.length) {
      totals.cleanTexts++;
      totals.cleanWords += words;
      totals.cleanFindings += findings.length;
      if (findings.length) totals.cleanFlagged++;
    }
    const references = edits.map(edit => {
      const expected = edit.replacements.map(value => minimalEdit(text, edit.start, edit.end, value));
      return { edit, expected, keys: new Set(expected.map(key)), found: -1, first: false };
    });
    const matched = new Set();
    // Reserve first suggestions before counting alternatives. Each finding
    // can satisfy at most one reference edit.
    for (const reference of references) {
      reference.found = findings.findIndex(({ alternatives }, i) =>
        !matched.has(i) && alternatives[0] && reference.keys.has(key(alternatives[0])));
      if (reference.found < 0) continue;
      reference.first = true;
      matched.add(reference.found);
    }
    for (const reference of references) {
      const { edit, expected, keys, first } = reference;
      const bucket = categories[edit.category] ??= { references: 0, found: 0, first: 0 };
      totals.references++;
      bucket.references++;
      const found = first ? reference.found : findings.findIndex(({ alternatives }, i) =>
        !matched.has(i) && alternatives.some(alternative => keys.has(key(alternative))));
      const located = found >= 0 || findings.some(({ issue, alternatives }) =>
        expected.some(e => (issue.start === e.start && issue.end === e.end)
          || alternatives.some(a => a.start === e.start && a.end === e.end)));
      if (located) totals.correctlyLocated++;
      if (found < 0) {
        missed.push({ id, category: edit.category, start: edit.start, end: edit.end });
        continue;
      }
      matched.add(found);
      totals.found++;
      bucket.found++;
      if (first) {
        totals.first++;
        bucket.first++;
      }
    }
    totals.unmatched += findings.length - matched.size;
  }
  return {
    ...totals, categories,
    recall: totals.references ? totals.found / totals.references : null,
    firstSuggestionRecall: totals.references ? totals.first / totals.references : null,
    firstSuggestionPrecision: totals.findings ? totals.first / totals.findings : null,
    cleanFindingsPerThousandWords: totals.cleanWords ? totals.cleanFindings * 1000 / totals.cleanWords : null,
    missed
  };
}
