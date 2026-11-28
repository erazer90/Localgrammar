const capitalize = word => word[0].toUpperCase() + word.slice(1);
const lowerHead = word => word[0].toLowerCase() + word.slice(1);
const nounTag = /^SUB:(NOM|DAT|AKK|GEN):(SIN|PLU):(MAS|FEM|NEU|NOG)(:ADJ)?$/u;

function nounEntries(lexicon, surface) {
  return lexicon.analyses(surface).filter(entry => nounTag.test(entry.tag));
}

function validModifier(lexicon, modifier) {
  const word = modifier.replace(/-$/u, "");
  if (nounEntries(lexicon, word).length) return true;
  if (word.length < 5) return false;
  const stem = word.replace(/(?:es|en|s|n)$/u, "");
  return (stem.length >= 4 && stem !== word && nounEntries(lexicon, stem).length > 0)
    || nounEntries(lexicon, word + "e").some(entry => entry.word === word + "e");
}

function compoundHead(lexicon, head) {
  const entries = nounEntries(lexicon, head);
  if (entries.length || !head.endsWith("er")) return entries;
  // The lexicon records some adjectival nouns under the form in -e only.
  const weak = head.slice(0, -1);
  return nounEntries(lexicon, weak)
    .filter(entry => entry.word === weak && entry.tag === "SUB:NOM:SIN:MAS:ADJ");
}

export function nounReadings(lexicon, surface) {
  let entries = nounEntries(lexicon, surface);
  let prefix = "";
  if (!entries.length && surface.length >= 7 && surface.length <= 48) {
    for (let i = 3; i <= surface.length - 3; i++) {
      const head = surface.slice(i);
      const modifier = surface.slice(0, i);
      if (!(modifier.endsWith("-") ? /^\p{Lu}\p{Ll}{2,}$/u : /^\p{Ll}{3,}$/u).test(head)) continue;
      if (!validModifier(lexicon, modifier)) continue;
      const readings = compoundHead(lexicon, capitalize(head));
      if (!readings.length) continue;
      if (prefix) return [];
      prefix = modifier;
      entries = readings;
    }
  }
  return entries.map(entry => {
    const [, grammaticalCase, number, gender, inflection] = nounTag.exec(entry.tag);
    return { lemma: entry.word, surface, grammaticalCase, number, gender, inflection, prefix };
  });
}

export function inflectNoun(lexicon, noun, targetCase) {
  if (noun.grammaticalCase === targetCase) return [noun.surface];
  const tag = `SUB:${targetCase}:${noun.number}:${noun.gender}${noun.inflection ?? ""}`;
  return lexicon.inflections(noun.lemma, tag).map(form =>
    noun.prefix ? noun.prefix + (noun.prefix.endsWith("-") ? form : lowerHead(form)) : form);
}
