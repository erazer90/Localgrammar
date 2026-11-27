export const MAX_TEXT = 12000;
export const MAX_ISSUES = 120;

export function limitText(text) {
  if (text.length <= MAX_TEXT) return text;
  const start = text.slice(0, MAX_TEXT);
  const boundary = Math.max(start.lastIndexOf("\n"), start.lastIndexOf(". "),
    start.lastIndexOf("! "), start.lastIndexOf("? "));
  if (boundary >= MAX_TEXT * 0.85) return start.slice(0, boundary + 1);
  const space = start.lastIndexOf(" ");
  if (space >= MAX_TEXT * 0.85) return start.slice(0, space);
  return start.replace(/[\uD800-\uDBFF]$/u, "");
}
