import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";
import { checkWithWasm } from "../../engine/lingotweaker.js";

const fetchBefore = globalThis.fetch;
const allowedFiles = new Map([
  ["lt_wasm_bg.wasm", "application/wasm"],
  ["packs/de.pack.gz", "application/octet-stream"],
  ["packs/en.pack.gz", "application/octet-stream"]
].map(([path, type]) => [new URL(`../../engine/vendor/${path}`, import.meta.url).href, type]));

const requestedFiles = new Set();
globalThis.fetch = async input => {
  const url = new URL(input);
  const type = allowedFiles.get(url.href);
  assert.ok(type, `Unexpected engine request: ${url.href}`);
  requestedFiles.add(url.href);
  return new Response(await readFile(url), { headers: { "Content-Type": type } });
};
after(() => { globalThis.fetch = fetchBefore; });

test("bundled WASM checks German grammar and spelling after an emoji", async () => {
  const text = "Ich habe gestern ein Film gesehen. 🙂 Die Gramatik ist schwierig.";
  const result = await checkWithWasm(text, "de", "", [], []);
  const spelling = result.issues.find(item => item.original === "Gramatik");
  assert.equal(result.engine, "wasm");
  assert.equal(result.language, "de");
  assert.ok(result.issues.some(item => item.suggestions.includes("einen Film")));
  assert.ok(spelling.suggestions.includes("Grammatik"));
  assert.equal(spelling.start, text.indexOf("Gramatik"));
  assert.equal(text.slice(spelling.start, spelling.end), "Gramatik");

  const accepted = await checkWithWasm(text, "de", "", ["gramatik"], []);
  assert.equal(accepted.issues.some(item => item.original === "Gramatik"), false);
  assert.ok(accepted.issues.some(item => item.suggestions.includes("einen Film")));
});

test("bundled WASM checks English agreement and the British spelling variant", async () => {
  const american = await checkWithWasm("🙂 She go to school.", "auto", "", [], []);
  assert.equal(american.language, "en");
  assert.ok(american.issues.some(item => item.start === 7 && item.original === "go"
    && item.suggestions.includes("goes")));
  const british = await checkWithWasm("This colour is lovely. The color is nice.", "en-GB", "", [], []);
  assert.equal(british.language, "en-GB");
  assert.ok(british.issues.some(item => item.original === "color" && item.suggestions.includes("colour")));
  assert.equal(british.issues.some(item => item.original === "colour"), false);
  assert.deepEqual(requestedFiles, new Set(allowedFiles.keys()));
});

test("German proofreading ranks contextual corrections and respects style, dictionary and ignore settings", async () => {
  const text = "🙂 Es ist vorallem fürcherlich. Ich suche den Spigel, kann IIhn nicht finden. Wie gehts dir?";
  const check = (words = [], ignored = [], style = true) => checkWithWasm(text, "de", "", words, ignored, style);
  const result = await check();
  for (const [original, fix] of Object.entries({
    vorallem: "vor allem", fürcherlich: "fürchterlich", Spigel: "Spiegel", IIhn: "ihn", gehts: "geht’s"
  })) {
    const matches = result.issues.filter(issue => issue.original === original);
    assert.equal(matches.length, 1, original);
    assert.equal(matches[0].suggestions[0], fix);
    assert.equal(matches[0].start, text.indexOf(original));
    assert.equal(text.slice(matches[0].start, matches[0].end), original);
  }
  const filtered = await check(["Spigel"], ["DE_SCHREIBWEISE"], false);
  assert.ok(filtered.issues.some(issue => issue.original === "IIhn"));
  assert.ok(!filtered.issues.some(issue => ["vorallem", "fürcherlich", "Spigel", "gehts"].includes(issue.original)));
});

test("location nouns are corrected without changing the preposition im", async () => {
  const text = "Gestern war ich mit meinen Freunden im park. Leider hat es plözlich angefangen zu regnen. Wir sind nach hause gegangen. Es war trozdem schön, weil wir viel spaß hatten.";
  const result = await checkWithWasm(text, "de", "", [], []);
  for (const [word, correction] of Object.entries({ park: "Park", plözlich: "plötzlich", hause: "Hause", trozdem: "trotzdem", spaß: "Spaß" })) {
    assert.ok(result.issues.some(issue => issue.original === word && issue.suggestions.includes(correction)), word);
  }
  assert.ok(!result.issues.some(issue => issue.original === "im"));
  const correct = await checkWithWasm("Ich sitze im Park. Ich helfe ihm. Ich park hier.", "de", "", [], []);
  assert.ok(!correct.issues.some(issue => issue.id === "DE_ORT_NOMEN"));
});

test("German spelling and compulsory punctuation find the right edit on a mixed corpus", async () => {
  // A vertical bar indicates an insertion and angle brackets mark a misspelling.
  const examples = [
    ["Wir bleiben zu Hause| weil es draußen regnet.", ","],
    ["Sie fragte| ob wir morgen Zeit hätten.", ","],
    ["Er sah| wie der Zug abfuhr.", ","],
    ["Er wusste| wann der Zug abfuhr.", ","],
    ["Ich weiß nicht| ob und wann er kommt.", ","],
    ["Ich schreibe dir| damit du Bescheid weißt.", ","],
    ["Wir gehen spazieren| obwohl es regnet.", ","],
    ["Ich gehe in den Laden| bevor er schließt.", ","],
    ["Wir essen| nachdem die Gäste angekommen sind.", ","],
    ["Wir warten| bis der Bus kommt.", ","],
    ["Ich bleibe hier| solange du mich brauchst.", ","],
    ["Wenn du Zeit hast| melde dich bitte.", ","],
    ["Weil es regnet| bleiben wir zu Hause.", ","],
    ["Das Buch, das ich gekauft habe| ist spannend.", ","],
    ["Sie läuft los| um den Bus zu erwischen.", ","],
    ["Sie ging fort| ohne ein Wort zu sagen.", ","],
    ["Wir hoffen| den Zug noch zu erreichen.", ","],
    ["Du kannst versuchen| ihn morgen anzurufen.", ","],
    ["Er hat Angst| den Anschluss zu verpassen.", ","],
    ["Wir wollten kommen| aber der Zug fiel aus.", ","],
    ["Hallo Anna| wie geht es dir?", ","],
    ["Hallo,|Welt!", " "],
    ["Das<,,> finde ich gut.", ","],
    ["Wir begrüßen die Gäste <herzich>.", "herzlich"],
    ["Wir gehen <einkauffen>.", "einkaufen"],
    ["Das ist <bessa> für alle.", "besser"],
    ["Das Gerät <funktinoiert> gut.", "funktioniert"],
    ["Wir haben die <Addresse> überprüft.", "Adresse"],
    ["Meine <Ruckmeldung> kommt morgen.", "Rückmeldung"],
    ["Die <Entwiklung> braucht Zeit.", "Entwicklung"],
    ["Wir müssen die Datei <seperate> speichern.", "separate"],
    ["Die Maschine war <paralell> in Betrieb.", "parallel"],
    ["Es gab ein <Missverständniss>.", "Missverständnis"],
    ["Der <Kalendar> ist voll.", "Kalender"],
    ["Die <Komunikation> klappt.", "Kommunikation"],
    ["Die <Rechtschrebung> ist wichtig.", "Rechtschreibung"],
    ["Ein äußerst guter <Rückblikk>.", "Rückblick"],
    ["Ich weiß nicht, seit wann du hier <seid>.", "bist"],
    ["Er hat <vergisst>, den Brief zu schicken.", "vergessen"]
  ];
  let text = "";
  const expected = examples.map(([example, suggestion]) => {
    const original = example.match(/<([^>]+)>/u)?.[1] ?? "";
    const start = text.length + example.search(/[|<]/u);
    text += example.replace(/[|<>]/gu, "") + "\n";
    return { example, start, end: start + original.length, original, suggestion };
  });
  const { issues } = await checkWithWasm(text, "de", "", [], [], false);
  for (const { example, suggestion, start, end, original } of expected) {
    const issue = issues.find(item => item.start === start && item.end === end && item.suggestions[0] === suggestion);
    assert.ok(issue, example);
    assert.equal(issue.original, original);
  }
});

test("correct German punctuation and equivalent Unicode spellings are left alone", async () => {
  const text = [
    "Wir bleiben zu Hause, weil es draußen regnet.",
    "Ich bleibe damit flexibel.",
    "Wir warten bis morgen.",
    "Während des Urlaubs lesen wir.",
    "Ich lese während der Ferien.",
    "Er hörte wie ein Profi.",
    "Ich esse Äpfel, Birnen und Bananen.",
    "Ich weiß nicht, ob und wann er kommt.",
    "Ich gehe, weil ich müde bin und weil es regnet.",
    "Das Buch, das ich gekauft habe, ist spannend.",
    "Sie versucht zu schlafen.",
    "Er braucht nicht zu kommen.",
    "Das Ergebnis sieht so aus wie erwartet.",
    "Das ist ein kleiner grüner Apfel.",
    "Der Preis liegt bei 1,50 Euro.",
    "Ich frage mich, wie lange du schon hier bist.",
    "Sie hat vergessen, uns anzurufen.",
    "Ein Text mit äußerst schönen Wörtern.",
    "Der Datenschutzbeauftragte prüft E-Mail-Adressen."
  ].join("\n");
  const { issues } = await checkWithWasm(text, "de", "", [], [], false);
  assert.deepEqual(issues, []);
});
