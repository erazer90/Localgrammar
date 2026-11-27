// The bundled German POS data uses Morfologik CFSA2 with the SUFFIX encoder.
// Format: https://morfologik.github.io/morfologik-stemming/
// The parser reads the dictionaries from the existing extension pack.
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const separator = 0x5f;
const nextNode = 0x80;
const lastArc = 0x40;
const accepting = 0x20;
const labelMask = 0x1f;

function packEntries(pack) {
  const view = new DataView(pack.buffer, pack.byteOffset, pack.byteLength);
  if (decoder.decode(pack.subarray(0, 5)) !== "LTPK1") throw new Error("Unsupported language pack");
  const entries = new Map();
  const count = view.getUint32(5, true);
  let cursor = 9;
  for (let i = 0; i < count; i++) {
    const size = view.getUint16(cursor, true);
    cursor += 2;
    const name = decoder.decode(pack.subarray(cursor, cursor + size));
    cursor += size;
    const start = Number(view.getBigUint64(cursor, true));
    const length = Number(view.getBigUint64(cursor + 8, true));
    if (start + length > pack.length) throw new Error("Invalid language pack entry");
    entries.set(name, { start, length });
    cursor += 16;
  }
  return entries;
}

function readDictionary(bytes) {
  if (decoder.decode(bytes.subarray(0, 4)) !== "\\fsa" || bytes[4] !== 0xc6 || bytes[5] !== 0 || bytes[6] !== 7) {
    throw new Error("Unsupported German dictionary format");
  }
  const labels = bytes.subarray(8, 8 + bytes[7]);
  const arcs = bytes.subarray(8 + bytes[7]);

  function after(arc) {
    let cursor = arc + ((arcs[arc] & labelMask) ? 1 : 2);
    if (!(arcs[arc] & nextNode)) {
      while (arcs[cursor++] & 0x80) { /* Skip the encoded address. */ }
    }
    return cursor;
  }

  function label(arc) {
    const index = arcs[arc] & labelMask;
    return index ? labels[index] : arcs[arc + 1];
  }

  function target(arc) {
    if (arcs[arc] & nextNode) {
      while (arc < arcs.length && !(arcs[arc] & lastArc)) arc = after(arc);
      if (arc >= arcs.length) throw new Error("Invalid dictionary arc");
      return after(arc);
    }
    let cursor = arc + ((arcs[arc] & labelMask) ? 1 : 2);
    let address = 0;
    let weight = 1;
    while (cursor < arcs.length) {
      const part = arcs[cursor++];
      address += (part & 0x7f) * weight;
      if (!(part & 0x80)) return address;
      weight *= 128;
    }
    throw new Error("Incomplete dictionary address");
  }

  const root = target(0);
  return function lookup(word, tag) {
    const key = tag ? `${word}|${tag}` : word;
    const source = encoder.encode(key);
    const prefix = encoder.encode(`${key}_`);
    if (prefix.length > 120) return [];
    let node = root;
    for (const byte of prefix) {
      let arc = node;
      while (arc < arcs.length && label(arc) !== byte && !(arcs[arc] & lastArc)) arc = after(arc);
      if (arc >= arcs.length || label(arc) !== byte) return [];
      node = target(arc);
      if (!node) return [];
    }
    const results = [];
    const suffix = [];
    function visit(arc) {
      if (suffix.length >= 120 || results.length >= 256) return;
      while (arc < arcs.length) {
        suffix.push(label(arc));
        if (arcs[arc] & accepting) results.push(decodeForm(source, suffix));
        const child = target(arc);
        if (child) visit(child);
        suffix.pop();
        if ((arcs[arc] & lastArc) || results.length >= 256) break;
        arc = after(arc);
      }
    }
    visit(node);
    return results.filter(Boolean);
  };
}

function decodeForm(source, suffix) {
  const split = suffix.indexOf(separator, 1);
  const trim = (suffix[0] - 65) & 0xff;
  const keep = trim === 255 ? 0 : source.length - trim;
  if (keep < 0) return null;
  const ending = suffix.slice(1, split < 0 ? undefined : split);
  const bytes = new Uint8Array(keep + ending.length);
  bytes.set(source.subarray(0, keep));
  bytes.set(ending, keep);
  return { word: decoder.decode(bytes), tag: split < 0 ? "" : decoder.decode(Uint8Array.from(suffix.slice(split + 1))) };
}

export function germanLexicon(pack) {
  const entries = packEntries(pack);
  function dictionary(file) {
    const entry = entries.get(`de/dictionaries/${file}`);
    if (!entry) throw new Error("Missing German morphology dictionary");
    return readDictionary(new Uint8Array(pack.subarray(entry.start, entry.start + entry.length)));
  }
  const lookupAnalyses = dictionary("german.dict");
  const cache = new Map();
  const inflections = dictionary("german_synth.dict");
  return {
    analyses(word) {
      if (!cache.has(word)) {
        if (cache.size >= 512) cache.delete(cache.keys().next().value);
        cache.set(word, lookupAnalyses(word));
      }
      return cache.get(word);
    },
    inflections: (lemma, tag) => [...new Set(inflections(lemma, tag).map(form => form.word))]
  };
}
