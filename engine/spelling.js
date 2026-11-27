// Score only the candidates the offline dictionary has already validated.
function editDistance(from, to) {
  const a = Array.from(from.toLowerCase());
  const b = Array.from(to.toLowerCase());
  let earlier = [];
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const mismatch = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + mismatch);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        row[j] = Math.min(row[j], earlier[j - 2] + 1);
      }
    }
    earlier = previous;
    previous = row;
  }
  return previous[b.length];
}

export function rankSpelling(original, suggestions) {
  if (!/^\p{L}[\p{L}\p{M}]{2,39}$/u.test(original) || suggestions.length < 2 || /[^\p{L}\p{M}]/u.test(suggestions[0])) return suggestions;
  const capital = /^\p{Lu}/u.test(original);
  return suggestions.map(value => {
    const word = /^\p{L}[\p{L}\p{M}]{1,45}$/u.test(value);
    const score = word ? editDistance(original, value) + (capital !== /^\p{Lu}/u.test(value) ? 0.75 : 0) : Infinity;
    return { value, score };
  }).sort((a, b) => a.score - b.score).map(({ value }) => value);
}
