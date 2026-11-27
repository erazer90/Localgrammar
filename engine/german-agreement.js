const token = "[\\p{L}\\p{M}]+(?:[-‑][\\p{L}\\p{M}]+)*";
const fixedPrepositions = new Map([
  ["mit", "DAT"], ["bei", "DAT"], ["von", "DAT"], ["zu", "DAT"], ["aus", "DAT"], ["seit", "DAT"],
  ["für", "AKK"], ["ohne", "AKK"], ["durch", "AKK"], ["gegen", "AKK"], ["um", "AKK"]
]);
const contractions = new Map([
  ["im", ["DAT", "MAS", "NEU"]], ["am", ["DAT", "MAS", "NEU"]],
  ["beim", ["DAT", "MAS", "NEU"]], ["vom", ["DAT", "MAS", "NEU"]],
  ["zum", ["DAT", "MAS", "NEU"]], ["zur", ["DAT", "FEM"]],
  ["ins", ["AKK", "NEU"]], ["ans", ["AKK", "NEU"]], ["aufs", ["AKK", "NEU"]]
]);
const nominalInfinitive = new Set(["am", "beim", "im", "zum"]);
const prepositionPattern = new RegExp(`(?<![\\p{L}\\p{M}.-])(${[...fixedPrepositions.keys(), ...contractions.keys()].join("|")})(?=[ \\t])`, "dgiu");
const followingWords = new RegExp(`^[ \\t]+(${token})(?:[ \\t]+(${token}))?(?:[ \\t]+(${token}))?`, "du");
const clausePattern = /(?:^|[.!?;:,\n][ \t]*)[ \t]*(?:(?:dass|weil|ob|wenn)\s+)?([^.!?;:,\n]+)/giu;
const spelledNoun = /^\p{Lu}/u;
const nounTag = /^SUB:(NOM|DAT|AKK|GEN):(SIN|PLU):(MAS|FEM|NEU|NOG)$/u;
const determinerTag = /^(ART:(?:DEF|IND)|PRO:(?:POS|DEM|IND)):(NOM|DAT|AKK|GEN):(SIN|PLU):(MAS|FEM|NEU)(?::(BEG|B\/S))?$/u;
const adjectiveTag = /^ADJ:(NOM|DAT|AKK|GEN):(SIN|PLU):(MAS|FEM|NEU):([^:]+):(DEF|IND|SOL)$/u;
const verbTag = /^(VER(?::(?:AUX|MOD))?):([123]):(SIN|PLU):(PRÄ|PRT|KJ1|KJ2)((?::[^:]+)*)$/u;
const persons = new Map([
  ["ich", ["1", "SIN"]], ["du", ["2", "SIN"]], ["er", ["3", "SIN"]], ["wir", ["1", "PLU"]]
]);

const capitalize = word => word[0].toUpperCase() + word.slice(1);
const compatibleGender = (left, right) => left === right || right === "NOG";

function nouns(lexicon, word) {
  const exact = lexicon.analyses(word);
  if (!spelledNoun.test(word) && exact.length) return [];
  const surface = spelledNoun.test(word) ? word : capitalize(word);
  return lexicon.analyses(surface).flatMap(entry => {
    const tag = nounTag.exec(entry.tag);
    return tag ? [{ lemma: entry.word, surface, grammaticalCase: tag[1], number: tag[2], gender: tag[3] }] : [];
  });
}

function determiners(lexicon, word) {
  return lexicon.analyses(word.toLowerCase()).flatMap(entry => {
    const tag = determinerTag.exec(entry.tag);
    return tag && (tag[1] === "ART:DEF" || tag[1] === "ART:IND" || tag[5])
      ? [{ lemma: entry.word, type: tag[1], grammaticalCase: tag[2], number: tag[3], gender: tag[4], use: tag[5] }]
      : [];
  });
}

function hasFeatures(article, noun, grammaticalCase) {
  return article.grammaticalCase === grammaticalCase && noun.number === article.number
    && compatibleGender(article.gender, noun.gender);
}

function possessiveStem(word) {
  const stem = /^(mein|dein|sein|ihr|unser|unsr|euer|eur)(?:e[mnrs]?)?$/u.exec(word.toLowerCase())?.[1];
  return { unsr: "unser", eur: "euer" }[stem] || stem;
}

function inflectArticle(lexicon, determiner, article, tag) {
  if (article.type !== "PRO:POS") return lexicon.inflections(article.lemma, tag);
  // The German data exposes the possessive endings under the paradigm "mein".
  const stem = possessiveStem(determiner);
  return lexicon.inflections("mein", tag).filter(value => possessiveStem(value) === stem);
}

function nounPhrases(lexicon, determiner, adjective, noun, targetCase) {
  const nounForms = nouns(lexicon, noun);
  const articles = determiners(lexicon, determiner);
  if (!nounForms.length || !articles.length) return [];
  const adjectiveForms = adjective ? lexicon.analyses(adjective).flatMap(entry => {
    const tag = adjectiveTag.exec(entry.tag);
    return tag ? [{ lemma: entry.word, grammaticalCase: tag[1], number: tag[2], gender: tag[3],
      degree: tag[4], declension: tag[5] }] : [];
  }) : [];
  if (adjective && !adjectiveForms.length) return [];

  const candidates = new Map();
  for (const n of nounForms) {
    for (const a of articles) {
      const gender = n.gender === "NOG" ? a.gender : n.gender;
      const declension = a.type === "ART:DEF" || a.type === "PRO:DEM" ? "DEF" : "IND";
      const compatibleAdjectives = adjectiveForms.filter(form => form.number === n.number
        && compatibleGender(form.gender, n.gender) && form.declension === declension);
      if (adjective && !compatibleAdjectives.length) continue;
      const consistentPhrase = hasFeatures(a, n, n.grammaticalCase);
      if (hasFeatures(a, n, targetCase) && n.grammaticalCase === targetCase
          && (!adjective || compatibleAdjectives.some(form => form.grammaticalCase === targetCase))
          && n.surface === noun) return [];

      const articleTag = [a.type, targetCase, n.number, gender, a.use].filter(Boolean).join(":");
      const articleWords = hasFeatures(a, n, targetCase) ? [determiner]
        : inflectArticle(lexicon, determiner, a, articleTag).map(word => spelledNoun.test(determiner) ? capitalize(word) : word.toLowerCase());
      const nounsInCase = n.grammaticalCase === targetCase ? [n.surface]
        : lexicon.inflections(n.lemma, `SUB:${targetCase}:${n.number}:${n.gender}`);
      const adjectivesInCase = adjective ? compatibleAdjectives.flatMap(form => (
        form.grammaticalCase === targetCase ? [adjective]
          : lexicon.inflections(form.lemma, `ADJ:${targetCase}:${n.number}:${form.gender}:${form.degree}:${declension}`)
      )) : [null];
      for (const articleWord of articleWords) {
        for (const nounWord of nounsInCase) {
          for (const adjectiveWord of adjectivesInCase) {
            if (articleWord === determiner && nounWord === noun && adjectiveWord === (adjective ?? null)) return [];
            const key = JSON.stringify([articleWord, adjectiveWord, nounWord]);
            // Prefer an analysis that preserves an already consistent phrase
            // and avoids changing a correct noun when it has another reading.
            const score = (consistentPhrase ? 4 : 0)
              + (a.number === n.number && compatibleGender(a.gender, n.gender) ? 2 : 0)
              + (nounWord === noun ? 1 : 0);
            if (score > (candidates.get(key) ?? -1)) candidates.set(key, score);
          }
        }
      }
    }
  }
  const highest = Math.max(...candidates.values());
  return [...candidates].filter(([, score]) => score === highest).map(([key]) => JSON.parse(key));
}

function prepositionalIssues(text, lexicon, add) {
  for (const match of text.matchAll(prepositionPattern)) {
    const prep = match[0].toLowerCase();
    const end = match.index + match[0].length;
    const following = followingWords.exec(text.slice(end));
    if (!following) continue;
    const [, first, second, third] = following;
    const [, firstRange, secondRange, thirdRange] = following.indices;
    if (contractions.has(prep)) {
      if (spelledNoun.test(first)) continue;
      const [grammaticalCase, ...genders] = contractions.get(prep);
      const readings = lexicon.analyses(first);
      const infinitive = nominalInfinitive.has(prep) && readings.some(entry => entry.tag.startsWith("VER:INF:"))
        && readings.every(entry => entry.tag.startsWith("VER:"));
      const nominal = nouns(lexicon, first).some(noun => noun.number === "SIN"
        && genders.includes(noun.gender) && noun.grammaticalCase === grammaticalCase);
      if (nominal || infinitive) {
        add("DE_ORT_NOMEN", end + firstRange[0], end + firstRange[1], capitalize(first), "Das Nomen wird großgeschrieben.");
      }
      continue;
    }
    if (!second || !determiners(lexicon, first).length) continue;
    if (prep === "um" && /^[^.!?;,]{0,70}\bwillen\b/u.test(text.slice(end, end + 76))) continue;
    const targetCase = fixedPrepositions.get(prep);
    const directNoun = nouns(lexicon, second).length > 0;
    const adjective = directNoun ? undefined : second;
    const noun = directNoun ? second : third;
    if (!noun) continue;
    const options = nounPhrases(lexicon, first, adjective, noun, targetCase);
    if (options.length !== 1) continue;
    const [articleWord, adjectiveWord, nounWord] = options[0];
    const originalWords = directNoun ? [first, second] : [first, second, third];
    const replacement = directNoun ? [articleWord, nounWord] : [articleWord, adjectiveWord, nounWord];
    const ranges = directNoun ? [firstRange, secondRange] : [firstRange, secondRange, thirdRange];
    const different = originalWords.map((word, i) => word === replacement[i] ? -1 : i).filter(i => i >= 0);
    const head = different[0];
    const tail = different.at(-1);
    let suggestion = replacement[head];
    for (let i = head + 1; i <= tail; i++) {
      suggestion += following[0].slice(ranges[i - 1][1], ranges[i][0]) + replacement[i];
    }
    add("DE_PRAEPOSITION_KASUS", end + ranges[head][0], end + ranges[tail][1], suggestion,
      `Nach „${prep}“ steht hier der ${targetCase === "DAT" ? "Dativ" : "Akkusativ"}.`);
  }
}

function verbalIssues(text, lexicon, add) {
  const wordTokens = new RegExp(token, "gu");
  for (const clause of text.matchAll(clausePattern)) {
    const body = clause[1];
    if (/[„“"«»]/u.test(body)) continue;
    const words = [...body.matchAll(wordTokens)];
    if (words.length < 2 || words[0].index !== 0) continue;
    const first = words[0][0].toLowerCase();
    let subject = persons.get(first);
    const verbIndex = subject ? 1 : 2;
    if (!subject && words.length >= 3 && spelledNoun.test(words[1][0])) {
      const articles = determiners(lexicon, first);
      const readings = nouns(lexicon, words[1][0]).filter(noun => noun.grammaticalCase === "NOM"
        && articles.some(article => hasFeatures(article, noun, "NOM")));
      const numbers = new Set(readings.map(noun => noun.number));
      // A following nominative can be the actual subject in an inverted
      // sentence. Keep ambiguous cases out of this local rule.
      const possibleSubject = words.slice(3).some(([word]) => spelledNoun.test(word)
        || /^(?:ich|du|er|sie|es|wir|ihr|man|wer|jemand|niemand)$/iu.test(word));
      if (numbers.size === 1 && !possibleSubject) subject = ["3", [...numbers][0]];
    }
    if (!subject || !words[verbIndex]) continue;
    const verb = words[verbIndex];
    const readings = lexicon.analyses(verb[0].toLowerCase());
    if (readings.some(entry => !entry.tag.startsWith("VER:"))) continue;
    const finite = readings.flatMap(entry => {
      const tag = verbTag.exec(entry.tag);
      return tag && !entry.word.includes(" ") ? [{ lemma: entry.word, type: tag[1], person: tag[2], number: tag[3], mood: tag[4], detail: tag[5] }] : [];
    });
    const [person, number] = subject;
    if (!finite.length || finite.some(form => form.person === person && form.number === number)) continue;
    const primary = finite.filter(form => form.mood === "PRÄ" || form.mood === "PRT");
    const forms = [...new Set((primary.length ? primary : finite).flatMap(form =>
      lexicon.inflections(form.lemma, `${form.type}:${person}:${number}:${form.mood}${form.detail}`)))];
    const standard = person === "1" && number === "SIN" && forms.length === 2
      ? forms.find(value => forms.includes(value.slice(0, -1)) && value.endsWith("e")) : undefined;
    const suggestion = standard ?? (forms.length === 1 ? forms[0] : undefined);
    if (!suggestion) continue;
    const start = clause.index + clause[0].length - body.length + verb.index;
    add("DE_SUBJEKT_VERB", start, start + verb[0].length, suggestion,
      "Die Verbform muss zu Person und Zahl des Subjekts passen.");
  }
}

export function germanAgreement(text, lexicon) {
  const issues = [];
  function add(id, start, end, replacement, message) {
    const original = text.slice(start, end);
    if (replacement !== original) issues.push({ id, start, end, original, suggestions: [replacement],
      kind: "grammar", preferred: true, message });
  }
  prepositionalIssues(text, lexicon, add);
  verbalIssues(text, lexicon, add);
  return issues;
}
