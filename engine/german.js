// Narrow complements to the offline checker. Capture only the text to replace.
const spelling = new Map(Object.entries({
  vorallem: "vor allem", aufjedenfall: "auf jeden Fall",
  aufkeinenfall: "auf keinen Fall", garnicht: "gar nicht", garnichts: "gar nichts",
  desweiteren: "des Weiteren", nocheinmal: "noch einmal", zumbeispiel: "zum Beispiel",
  fürcherlich: "fürchterlich", fürchterllich: "fürchterlich", nähmlich: "nämlich",
  warscheinlich: "wahrscheinlich", eigendlich: "eigentlich", entgültig: "endgültig",
  vorraussetzung: "Voraussetzung", vorraussetzungen: "Voraussetzungen"
}));
const letter = "[\\p{L}\\p{M}\\p{N}_-]";
const misspellings = new RegExp(`(?<!${letter})(${[...spelling.keys()].join("|")})(?!${letter})`, "dgiu");

const rules = [
  ["DE_ORT_NOMEN", /(?<!\p{L})(?:[Ii]m|[Aa]m|[Zz]um|[Vv]om|[Bb]eim|[Ii]n dem|[Aa]n dem|[Ii]n den|[Dd]urch den|[Ii]n einem)[ \t]+(park|garten|wald|büro|kino|haus|bahnhof|see|restaurant|museum|hotel|supermarkt|schwimmbad|krankenhaus|zug|bus|auto|zimmer|urlaub)(?![\p{L}-])/dgu,
    word => word[0].toUpperCase() + word.slice(1), "grammar", "Das Nomen nach dieser Präposition wird großgeschrieben."],
  ["DE_SCHREIBWEISE", misspellings, word => spelling.get(word.toLowerCase()), "spelling", "Prüfe die Schreibweise."],
  ["DE_IM_VORAUS", /(?<![\p{L}-])[Ii]m[ \t]+([Vv]orraus|voraus)(?![\p{L}-])/dgu,
    () => "Voraus", "grammar", "In der Wendung „im Voraus“ wird das Nomen großgeschrieben."],
  ["DE_FESTE_WENDUNG", /(?<![\p{L}-])(?:zum[ \t]+(beispiel)|des[ \t]+(weiteren)|im[ \t]+(großen und ganzen))(?![\p{L}-])/dgiu,
    word => ({ beispiel: "Beispiel", weiteren: "Weiteren", "großen und ganzen": "Großen und Ganzen" })[word.toLowerCase()],
    "grammar", "Achte auf die Großschreibung in dieser Wendung."],
  ["DE_SPIEGEL", /(?<!\p{L})(?:den|dem|der|ein|einen|im)[ \t]+(Spigel)(?![\p{L}-])/dgiu,
    () => "Spiegel", "spelling", "Meinst du den Spiegel?"],
  ["DE_PRONOMEN_IHN", /(?<!\p{L})(?:kann|konnte|habe|hat|sehe|sieht|finde|suche)[ \t]+(IIhn)(?![\p{L}-])/dgu,
    () => "ihn", "grammar", "Das Pronomen lautet hier „ihn“."],
  ["DE_KOMMA_DASS", /(?<!\p{L})(?:[Ii]ch|[Ee]r|[Ss]ie)[ \t]+(?:hoffe|hofft|glaube|glaubt|weiß|denke|denkt|merke|merkt|sehe|sieht)([ \t]+dass)(?!\p{L})/dgu,
    () => ", dass", "grammar", "Vor dem Nebensatz mit „dass“ steht ein Komma."],
  ["DE_DERSELBE", /(?<![\p{L}-])(der selbe|die selbe|das selbe|den selben|dem selben|des selben)(?![\p{L}-])/dgiu,
    words => words[0] + words.slice(1).toLowerCase().replace(" ", ""), "grammar", "Die Formen von „derselbe“ werden zusammengeschrieben."],
  ["DE_GRUSSFORMEL", /(?<!\p{L})(?:[Mm]it[ \t]+freundlichen[ \t]+(grüßen)|[Vv]ielen[ \t]+(dank)(?=[ \t]+für\b|[.!]))(?![\p{L}-])/dgu,
    word => word[0].toUpperCase() + word.slice(1), "grammar", "Das Nomen in dieser Grußformel wird großgeschrieben."],
  ["DE_NOMEN_VOR_VERB", /(?<![\p{L}-])(logo|design|einstellungen|features)(?=(?:[ \t]+und[ \t]+(?:[Ll]ogo|[Dd]esign|[Ee]instellungen|[Ff]eatures))?[ \t]+(?:einbauen|gestalten|polieren|überarbeiten|ändern|öffnen|speichern|integrieren|anpassen)(?!\p{L}))/dgu,
    word => word[0].toUpperCase() + word.slice(1), "grammar", "Dieses Nomen wird großgeschrieben."],
  ["DE_GEDANKENSTRICH", /(?<=\p{L}{2}[ \t])(-)(?=[ \t]\p{L}{2})/dgu,
    () => "–", "style", "Für einen Einschub passt ein Gedankenstrich."],
  ["DE_WIE_GEHTS", /(?<!\p{L})[Ww]ie[ \t]+(gehts)(?=[ \t]+(?:dir|euch|Ihnen)(?!\p{L}))/dgu,
    () => "geht’s", "style", "Der Apostroph kann die Kurzform von „geht es“ verdeutlichen."]
];

export function germanCorrections(text) {
  const issues = [];
  for (const [id, pattern, fix, kind, message] of rules) {
    for (const match of text.matchAll(pattern)) {
      const [start, end] = match.indices.slice(1).find(Boolean);
      const original = text.slice(start, end);
      let replacement = fix(original);
      if (id === "DE_SCHREIBWEISE" && (/^\p{Lu}/u.test(original)
          || /(?:^|[.!?])[\s„“»«]*$/u.test(text.slice(0, start)))) {
        replacement = replacement[0].toUpperCase() + replacement.slice(1);
      }
      if (replacement !== original) issues.push({ id, start, end, original, suggestions: [replacement], preferred: true, message, kind });
    }
  }
  return issues;
}
