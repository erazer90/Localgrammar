const pronouns = new Map([
  ["der", /:SIN:MAS$/u], ["die", /(?::SIN:FEM|:PLU:[A-Z]+)$/u],
  ["das", /:SIN:NEU$/u], ["den", /:SIN:MAS$/u], ["dem", /:SIN:(?:MAS|NEU)$/u],
  ["dessen", /:SIN:(?:MAS|NEU)$/u], ["deren", /(?::SIN:FEM|:PLU:[A-Z]+)$/u], ["denen", /:PLU:[A-Z]+$/u]
]);
const subjectForms = new Map([
  ["ich", ["1:SIN"]], ["du", ["2:SIN"]], ["er", ["3:SIN"]], ["sie", ["3:SIN", "3:PLU"]],
  ["es", ["3:SIN"]], ["wir", ["1:PLU"]], ["ihr", ["2:PLU"]], ["man", ["3:SIN"]]
]);
const subjectRelative = /^(?:der|die|das)$/u;
const relativeLead = /^(?:auf|aus|bei|durch|für|gegen|hinter|in|mit|nach|neben|ohne|seit|über|um|unter|vor|während|wegen|zu|dort|hier|gerade|noch|bereits|immer|schon|oft|nicht|gestern|heute|damals)$/u;
const continuationAdverb = /^(?:dann|doch|jetzt|heute|morgen|nachher|später|gleich|auch|wieder|endlich|bitte|noch|mit)$/u;
const particle = /^(?:ab|an|auf|aus|bei|ein|fest|her|hin|los|mit|nach|vor|weg|weiter|zu|zurück|zusammen)$/u;
const finiteTag = /^VER:(?:(?:AUX|MOD):)?[123]:(?:SIN|PLU):/u;

export function unambiguousFinite(word, lexicon) {
  if (!lexicon) return false;
  const entries = lexicon.analyses(word);
  return entries.some(({ tag }) => finiteTag.test(tag))
    && entries.every(({ tag }) => tag.startsWith("VER:") && !tag.includes(":INF"));
}

export function agreesWithSubject(word, subject, lexicon) {
  const forms = subjectForms.get(subject);
  return !!(lexicon && forms && lexicon.analyses(word).some(({ tag }) => finiteTag.test(tag)
    && forms.some(form => tag.includes(":" + form + ":"))));
}

function closesWithParticle(words, preceding, end, lexicon) {
  const last = words.at(-1)[0];
  if (!particle.test(last) || end >= words.length - 1
      || !words.slice(end + 1, -1).every(([word]) => continuationAdverb.test(word))) return false;
  for (const [word] of preceding) {
    for (const { tag, word: lemma } of lexicon.analyses(word)) {
      if (finiteTag.test(tag) && lexicon.analyses(last + lemma).some(entry => entry.tag.startsWith("VER:INF"))) return true;
    }
  }
  return false;
}

// Require an antecedent and an identifiable verb. This keeps demonstratives
// and ordinary noun phrases out of the relative-clause rule.
export function relativeCommas(text, clause, words, lexicon, add) {
  const boundary = text[clause.index - 1];
  const precedingClause = boundary === "," ? text.slice(Math.max(0, clause.index - 161), clause.index - 1)
    .match(/[^,.!?;:…\n\r]+$/u)?.[0] : null;
  for (let start = 0; start < words.length - 2; start++) {
    const [pronoun] = words[start];
    const features = pronouns.get(pronoun);
    if (!features || (start === 0 && boundary !== ",")) continue;
    const head = start > 0 ? words[start - 1][0] : precedingClause?.match(/[\p{L}\p{M}-]+(?=[ \t]*$)/u)?.[0];
    if (!head || !/^\p{Lu}/u.test(head)) continue;
    const heads = lexicon.analyses(head).filter(({ tag }) =>
      tag.startsWith("SUB:") && features.test(tag.replace(/:ADJ$/u, "")));
    if (!heads.length) continue;
    const next = words[start + 1][0];
    const explicit = subjectForms.has(next);
    const direct = subjectRelative.test(pronoun) && unambiguousFinite(next, lexicon);
    if (!explicit && !direct && !(subjectRelative.test(pronoun) && relativeLead.test(next))) continue;
    const after = words.slice(start + (direct ? 1 : 2));
    const verbOffset = after.findIndex(([word], index) => unambiguousFinite(word, lexicon)
      || ((index === after.length - 1 || separatePredicates(after, index, lexicon))
        && (explicit ? agreesWithSubject(word, next, lexicon) : heads.some(({ tag }) =>
          tag.includes(":PLU:") && agreesWithSubject(word, "sie", lexicon)))));
    if (verbOffset < 0) continue;
    const end = start + (direct ? 1 : 2) + verbOffset;
    const adjacentPredicates = separatePredicates(words, end, lexicon);
    const preceding = start > 0 ? words.slice(0, start - 1)
      : [...(precedingClause?.matchAll(/[\p{L}\p{M}-]+/gu) ?? [])].slice(0, -1);
    const hasClosing = adjacentPredicates || closesWithParticle(words, preceding, end, lexicon);
    // A verb directly after the pronoun can also start a new clause. An
    // existing boundary or two separate predicates disambiguate that case.
    if (direct && !hasClosing && (start > 0 || after.length > 1)) continue;
    if (start > 0 && (hasClosing || end === words.length - 1)) insertAfter(words[start - 1], words[start]);
    if (hasClosing) insertAfter(words[end], words[end + 1]);
    if (hasClosing || end === words.length - 1) break;
  }

  function insertAfter(previous, next) {
    const end = previous.index + previous[0].length;
    if (!/^[ \t]+$/u.test(clause[0].slice(end, next.index))) return;
    add("DE_KOMMA_NEBENSATZ", clause.index + end, "", ",", "Der Relativsatz wird durch Kommas abgegrenzt.");
  }
}

function separatePredicates(words, index, lexicon) {
  const next = words[index + 1]?.[0];
  if (!next || !unambiguousFinite(next, lexicon)) return false;
  const modal = lexicon.analyses(next).some(({ tag }) => tag.startsWith("VER:MOD:"));
  const infinitive = lexicon.analyses(words[index][0]).some(({ tag }) => tag.includes(":INF"));
  // “die wir sichern konnten” contains an infinitive before the modal,
  // whereas “die wir gesehen haben könnte …” resumes the main clause.
  return !modal || !infinitive || lexicon.analyses(words[index - 1]?.[0] ?? "").some(({ tag }) => tag.startsWith("PA2:"));
}
