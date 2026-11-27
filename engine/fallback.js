import { MAX_ISSUES, limitText } from "./limits.js";

// Keep the original rule IDs for stored ignore settings. Ambiguous words
// from the original checker now require an explicit contextual pattern.
const DE = [
  ["DAS_DASS", /\b(?:weiß|glaube|hoffe|denke|wusste|meine|sagte),\s+(das)(?=\s+(?:ich|du|wir|ihr|sie|er)\b)/giu, "Hier wird „dass“ als Konjunktion verwendet.", ["dass"], 1],
  ["SEIT_SEID", /(?<!\p{L})(seit)(?=\s+ihr\s+(?:bereit|sicher|fertig|euch|hier|da)\b)/giu, "Das Verb zu „ihr“ lautet „seid“.", ["seid"], 1],
  ["SEIT_SEID", /\b(seid)(?=\s+(?:gestern|heute|vorgestern|Jahren|Wochen|Monaten)\b)/giu, "Für Zeitangaben wird „seit“ verwendet.", ["seit"], 1],
  ["WIEDER_WIDER", /\b(wieder)(?=\s+besseres\s+Wissen\b)/giu, "Die feste Wendung lautet „wider besseres Wissen“.", ["wider"], 1],
  ["MAN_MANN", /\b(mann)(?=\s+(?:kann|muss|sollte|darf)\b)/giu, "Das unpersönliche Pronomen lautet „man“.", ["man"], 1, false, (m, text) => !/\b(?:der|ein|dieser|jener|jeder|mein|dein|ihr|kein)\s+$/iu.test(text.slice(Math.max(0, m.index - 40), m.index)) && m[1] === "mann"],
  ["WEGEN_DEM", /\bwegen dem(?=\s+\p{Lu})/gu, "Prüfe hier den Genitiv nach „wegen“.", [], 0, true],
  ["ALS_WIE", /\bals wie\b/giu, "Prüfe die Vergleichspartikel.", ["als", "wie"]],
  ["ICH_HAB", /\bich hab\b(?!['’])/giu, "In formellen Texten passt „ich habe“.", ["ich habe"], 0, true],
  ["ZWEIMAL", /\b(zwei|drei|vier|fünf) mal\b/giu, "Diese Häufigkeitsangabe wird meist zusammengeschrieben.", m => [m[0].replace(" ", "")], 0, true],
  ["KOMMT_DRAUF", /\bkommt drauf an\b/giu, "In formellen Texten passt „kommt darauf an“.", ["kommt darauf an"], 0, true],
  ["SO_ZUM_BEISPIEL", /\bzum (beispiel)\b/gu, "„Beispiel“ wird großgeschrieben.", ["Beispiel"], 1],
  ["DOUBLE_SPACE", /(?<=\S) {2,}(?=\S)/gu, "Überzählige Leerzeichen.", [" "], 0, true],
  ["SATZANFANG", /(?<=[!?][ \t])([a-zäöü])/gu, "Am Satzanfang gilt Großschreibung.", m => [m[0].toUpperCase()]],
  ["WAR_WAHR", /\bist das wirklich (war)\b/giu, "Hier passt das Adjektiv „wahr“.", ["wahr"], 1],
  ["KEINE_AHNUNG", /\bkein ahnung\b/giu, "Korrekt ist „keine Ahnung“.", ["keine Ahnung"]]
];

const EN = [
  ["A_AN", /\b(a)(?=\s+(?:apple|egg|elephant|idea|orange|umbrella|hour|honest)\b)/giu, "Use “an” before a vowel sound.", ["an"], 1],
  ["THEIR_THERE", /\b(their)(?=\s+(?:is|are|was|were)\b)/giu, "This construction takes “there”.", ["there"], 1],
  ["YOUR_YOURE", /\b(your)(?=\s+(?:a good|very welcome|going to|welcome to)\b)/giu, "Use “you’re” for “you are”.", ["you’re"], 1],
  ["ITS_ITS", /\b(its)(?=\s+(?:a good|going to|been a)\b)/giu, "Use “it’s” for “it is” or “it has”.", ["it’s"], 1],
  ["DOUBLE_SPACE", /(?<=\S) {2,}(?=\S)/gu, "Extra spaces between words.", [" "], 0, true]
];

export function fallbackLanguage(text, preference, hint) {
  if (preference !== "auto") return preference;
  const de = (text.match(/\b(?:ich|du|das|dass|der|die|den|und|ist|sind|nicht|mit|für|wir|haben)\b|[äöüß]/giu) || []).length;
  const en = (text.match(/\b(?:the|and|is|are|you|we|has|have|were|of|to|this|that|a|an|my|your|she|he|they)\b/giu) || []).length;
  if (en > de) return /^en-GB\b/i.test(hint) ? "en-GB" : "en";
  if (de > en) return "de";
  return /^en-GB\b/i.test(hint) ? "en-GB" : /^en\b/i.test(hint) ? "en" : "de";
}

export function fallbackCheck(value, preference, hint, ignoredRules) {
  const text = limitText(value);
  const language = fallbackLanguage(text, preference, hint);
  const ignored = new Set(ignoredRules);
  const issues = [];
  for (const [id, pattern, message, fixes, group = 0, style = false, condition] of language === "de" ? DE : EN) {
    if (ignored.has(id)) continue;
    for (const match of text.matchAll(new RegExp(pattern.source, pattern.flags + "d"))) {
      if (condition && !condition(match, text)) continue;
      const [start, end] = match.indices[group];
      const original = text.slice(start, end);
      const suggestions = (typeof fixes === "function" ? fixes(match) : fixes).map(fix =>
        /^\p{Lu}/u.test(original) ? fix.charAt(0).toUpperCase() + fix.slice(1) : fix);
      issues.push({ id, start, end, original, message, kind: style ? "style" : "grammar", suggestions });
    }
  }
  issues.sort((a, b) => a.start - b.start || a.end - b.end);
  return { engine: "fallback", language, truncated: text.length < value.length, issues: issues.slice(0, MAX_ISSUES) };
}
