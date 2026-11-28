import { minimalEdit } from "./scoring.js";

function detokenize(tokens) {
  let result = "";
  let afterOpening = false;
  let quoteOpen = false;
  for (const token of tokens) {
    const closes = /^[,.!?:;%…)}\]»”]+$/u.test(token) || (token === '"' && quoteOpen);
    const opens = /^[[({„«“]$/u.test(token) || (token === '"' && !quoteOpen);
    result += (result && !afterOpening && !closes ? " " : "") + token;
    if (token === '"') quoteOpen = !quoteOpen;
    afterOpening = opens;
  }
  return result;
}

function category(label, replacement) {
  if (label.includes("PUNCT") || /^[,.!?;:]+$/u.test(replacement.trim())) return "Zeichensetzung";
  if (label.includes("SPELL") || label.includes("ORTH")) return "Rechtschreibung";
  if (/VERB|DET|MORPH|NOUN|ADJ|PRON|ADP/u.test(label)) return "Grammatik";
  return "Sonstige";
}

export function parseM2(source) {
  return source.trim().split(/\r?\n\s*\r?\n/u).flatMap((block, index) => {
    const [header, ...annotation] = block.split(/\r?\n/u);
    if (!header.startsWith("S ")) return [];
    const tokens = header.slice(2).trim().split(/\s+/u);
    const text = detokenize(tokens);
    const edits = [];
    for (const line of annotation) {
      const [range, label, correction, , , coder] = line.split("|||");
      const bounds = /^A (\d+) (\d+)$/u.exec(range);
      if (!bounds || (coder !== undefined && coder !== "0") || !label || correction === undefined) continue;
      const start = Number(bounds[1]);
      const end = Number(bounds[2]);
      if (start > end || end > tokens.length) continue;
      const replacements = correction.trim() ? correction.trim().split(/\s+/u) : [];
      const corrected = detokenize([...tokens.slice(0, start), ...replacements, ...tokens.slice(end)]);
      if (corrected === text) continue;
      const edit = minimalEdit(text, 0, text.length, corrected);
      edits.push({ start: edit.start, end: edit.end, replacements: [edit.replacement],
        category: category(label, edit.replacement) });
    }
    return [{ id: `fm-${index + 1}`, genre: "Lerntexte", text, edits }];
  });
}
