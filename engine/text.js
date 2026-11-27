const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// The dictionaries use NFC. Restore offsets and original text before sending
// issues back to the editor so decomposed characters can be replaced safely.
export function normalizeText(source) {
  const text = source.normalize("NFC");
  if (text === source) return { text, restore: issues => issues };
  const offsets = new Map([[0, 0]]);
  let length = 0;
  for (const { segment, index } of graphemes.segment(source)) {
    const normalized = segment.normalize("NFC");
    if (normalized === segment) {
      for (let i = 1; i < segment.length; i++) offsets.set(length + i, index + i);
    }
    length += normalized.length;
    offsets.set(length, index + segment.length);
  }
  return { text, restore: issues => issues.flatMap(issue => {
    const start = offsets.get(issue.start);
    const end = offsets.get(issue.end);
    return start === undefined || end === undefined ? []
      : [{ ...issue, start, end, original: source.slice(start, end) }];
  }) };
}
