import { agreesWithSubject, relativeCommas, unambiguousFinite } from "./relative.js";

// Clause boundaries and mandatory commas, based on §§ 71 and 73 of the
// Amtliches Regelwerk (2024): https://grammis.ids-mannheim.de/rechtschreibung/6199
const subordinators = new Set([
  "dass", "weil", "obwohl", "bevor", "nachdem", "sobald", "sofern", "falls",
  "indem", "zumal", "sodass", "wenngleich"
]);
const ambiguous = new Set(["damit", "bis", "seit", "während", "solange", "wenn"]);
const indirect = new Set(["ob", "wie", "wann", "wo", "warum", "weshalb"]);
const subject = /^(?:ich|du|er|sie|es|wir|ihr|man|(?:der|die|das|ein|eine|mein|dein|sein|ihr|unser|euer|dieser|diese|dieses)\s+\p{Lu}\p{L}+)\s+\S/u;
const relativeSubject = /^(?:ich|du|er|sie|es|wir|ihr|man)$/u;
const relativePronoun = /^(?:der|die|das|den|dem|dessen|deren)$/u;
const coordination = /^(?:und|oder|sowie|weder|noch|beziehungsweise|sowohl|entweder)$/u;
const reporting = /(?<!\p{L})(?:frag\w*|weiß|wusst\w*|wiss\w*|wüsst\w*|sah\w*|seh\w*|hör\w*|zeig\w*|erklär\w*|sag\w*|versteh\w*|verstand\w*|überleg\w*|erinner\w*|entscheid\w*|entschied\w*)(?!\p{L})/iu;
const infinitiveGovernor = /^(?:versuch(?:e|st|t|te|ten|en)|hoff(?:e|st|t|te|ten|en)|plan(?:e|st|t|te|ten|en)|vergiss|vergess(?:e|en|t)|vorschlag|absicht|aufgabe|angst|lust|möglichkeit|entschied(?:en)?|beschloss(?:en)?|versprach(?:en)?|versprochen)$/iu;
const finite = /^(?:bin|bist|ist|sind|seid|war(?:en|st|t)?|hab(?:e|en|t)|ha(?:st|t)|hatt(?:e|est|en|et)|werd(?:e|en|et)|wirst|wird|wurd(?:e|est|en|et)|kann(?:st)?|könn(?:en|t)|muss(?:t)?|müss(?:en|t)|will(?:st)?|woll(?:en|t)|soll(?:st|t|en)?|darf(?:st)?|dürf(?:en|t)|regnet|schneit|bleib(?:e|st|t|en)|komm(?:e|st|t|en)|geh(?:e|st|t|en)|fahr(?:e|st|t|en)|sag(?:e|st|t|en))$/iu;
const imperative = /^(?:melde|sag|sage|ruf|rufe|komm|komme|geh|gehe|bleib|bleibe|schreib|schreibe|nimm|bring|bringe|warte|mach|mache|lass)$/iu;
const clausePieces = /[^,.!?;:…\n\r]+/gu;
const wordPattern = /\p{L}[\p{L}\p{M}’'–-]*/gu;

function clauseCommas(text, add, lexicon) {
  for (const clause of text.matchAll(clausePieces)) {
    const words = [...clause[0].matchAll(wordPattern)];
    const boundary = text[clause.index - 1];
    const initial = words[0]?.[0].toLowerCase();
    // A relative clause with an explicit subject can occur after the head noun
    // in this segment, or follow the comma that already separates it.
    let relativeStart = -1;
    for (let i = 0; i < words.length - 3; i++) {
      const token = words[i][0];
      if (!relativePronoun.test(token) || !relativeSubject.test(words[i + 1][0])) continue;
      if ((i === 0 && boundary === ",") || (i > 0 && /^\p{Lu}/u.test(words[i - 1][0]))) {
        relativeStart = i;
        break;
      }
    }
    for (let i = 1; i < words.length - 1; i++) {
      const previous = words[i - 1];
      const next = words[i];
      const before = clause[0].slice(0, next.index);
      const after = clause[0].slice(words[i + 1].index);
      const gap = clause[0].slice(previous.index + previous[0].length, next.index);
      if (!/^[ \t]+$/u.test(gap) || coordination.test(previous[0].toLowerCase())) continue;
      const word = next[0];
      const hasSubject = subject.test(after);
      const finiteAfter = finite.test(words.at(-1)?.[0])
        || /^\p{Ll}{2,}(?:t|en)$/u.test(words.at(-1)?.[0]);
      // Determiners and subjects keep “bis morgen”, “während des Urlaubs”,
      // and the pronominal “damit” out of this rule.
      const hasClause = (subordinators.has(word) && !/^(?:wort|ausdruck|begriff|konjunktion)$/iu.test(previous[0]))
        || (ambiguous.has(word) && hasSubject
          && (word !== "während" || relativeSubject.test(words[i + 1][0]) || finiteAfter))
        || (indirect.has(word) && (hasSubject || (word === "ob" && /^und\s+wann\s/u.test(after)))
          && reporting.test(before) && !/^(?:so|genauso|ebenso|anders|aus)$/iu.test(previous[0]))
        || ((word === "aber" || word === "sondern") && hasSubject && i >= 2);
      const hasGovernor = infinitiveGovernor.test(previous[0]);
      const connectorGap = clause[0].slice(next.index + next[0].length, words[i + 1].index);
      const infinitiveMarker = ["um", "ohne", "statt", "anstatt", "außer"].includes(word)
        && /^[ \t]+$/u.test(connectorGap);
      const laterWords = (hasGovernor || infinitiveMarker) ? words.slice(i + 1) : [];
      const hasInfinitive = laterWords.some((entry, index) => (
        entry[0] === "zu" && /^(?:\p{Ll}{2,}en|tun|sein)$/u.test(laterWords[index + 1]?.[0] || "")
      ) || /^\p{Ll}{2,}zu\p{Ll}{2,}en$/u.test(entry[0]));
      // An unexpanded zu-infinitive can be integrated in the predicate.
      const isInfinitive = (infinitiveMarker && hasInfinitive)
        || (hasGovernor && laterWords.length >= 2 && hasInfinitive && (hasSubject
          || /^(?:ihn|sie|es|sie alle|uns|euch|noch|heute|morgen|rechtzeitig|pünktlich)\b/u.test(next[0])
          || /^(?:den|dem|der|die|das|ein|eine|einen|meine|deine|seine)\b/u.test(next[0])));
      const closesSubordinate = i >= 3 && !boundary?.match(/[:,]/u)
        && (subordinators.has(initial) || ambiguous.has(initial))
        && (finite.test(previous[0]) || unambiguousFinite(previous[0], lexicon))
        && (imperative.test(next[0]) || finite.test(next[0]) || unambiguousFinite(next[0], lexicon)
          || agreesWithSubject(next[0], words[i + 1][0], lexicon))
        && /^(?:ich|du|er|sie|es|wir|ihr|man|bitte|mich|dich|uns)$/iu.test(words[i + 1][0]);
      const closesRelative = relativeStart >= 0 && relativeStart + 2 < i
        && (lexicon
          ? unambiguousFinite(previous[0], lexicon) && unambiguousFinite(next[0], lexicon)
          : finite.test(previous[0]) && /^(?:ist|sind|war|waren|wird|werden|hat|haben|kann|können|muss|müssen)$/u.test(next[0]));
      if (hasClause || isInfinitive || closesSubordinate || closesRelative) {
        add(isInfinitive ? "DE_KOMMA_INFINITIV" : "DE_KOMMA_NEBENSATZ", clause.index + next.index - gap.length,
          "", ",", isInfinitive ? "Die Infinitivgruppe wird durch ein Komma abgegrenzt." : "Hier trennt ein Komma die Satzteile.");
      }
    }
    if (lexicon) relativeCommas(text, clause, words, lexicon, add);
  }
}

export function germanPunctuation(text, lexicon) {
  const issues = [];
  function add(id, start, original, replacement, message) {
    issues.push({ id, start, end: start + original.length, original, message, kind: "grammar",
      suggestions: [replacement], preferred: true });
  }

  clauseCommas(text, add, lexicon);
  for (const match of text.matchAll(/(?:^|[.!?]\s+)(?:Hallo|Hi)[ \t]+\p{Lu}\p{Ll}+[ \t]+(?=(?:wie|wann|wo|was|warum|kannst|hast|bist)\b)/gu)) {
    const end = match.index + match[0].trimEnd().length;
    add("DE_KOMMA_ANREDE", end, "", ",", "Die Anrede wird vom folgenden Satz getrennt.");
  }
  for (const match of text.matchAll(/(?<=\p{L})([ \t]+)(?=[,;:!?](?:[ \t\p{L}„»]|$))/dgu)) {
    add("DE_SATZZEICHEN_ABSTAND", match.index, match[0], "", "Vor diesem Satzzeichen entfällt das Leerzeichen.");
  }
  for (const match of text.matchAll(/(?<=[\p{L}\p{N}])([,;:])(?=[\p{L}„»])/dgu)) {
    const token = text.slice(0, match.index).match(/\S+$/u)?.[0] ?? "";
    if (/[/:@#]/u.test(token) || /^(?:mailto|tel|urn|sms)$/iu.test(token)) continue;
    add("DE_SATZZEICHEN_ABSTAND", match.index + 1, "", " ", "Nach diesem Satzzeichen fehlt ein Leerzeichen.");
  }
  for (const match of text.matchAll(/(?<=\p{L})(,{2,}|;{2,})(?=[ \t]+\p{L})/gu)) {
    add("DE_SATZZEICHEN_DOPPELT", match.index, match[0], match[0][0], "Ein Satzzeichen genügt an dieser Stelle.");
  }
  return issues;
}
