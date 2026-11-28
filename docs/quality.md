# Deutsche Prüfqualität

Der Benchmark vergleicht die gebündelte Offline-Engine mit früheren Releases und optional mit der lokalen LanguageTool-Kommandozeile. Beide prüfen Deutsch (Deutschland) mit Standardregeln für Rechtschreibung und Grammatik. Stil- und Typografiehinweise werden aus der Auswertung ausgeschlossen. [LanguageTool 6.8](https://github.com/languagetool-org/languagetool/tree/v6.8) · [Offizielles CLI-Archiv](https://repo.maven.apache.org/maven2/org/languagetool/languagetool-standalone/6.8/languagetool-standalone-6.8.zip)

## Reproduzieren

```bash
npm ci
git worktree add --detach ../localgrammar-4.1.3 v4.1.3
npm run benchmark:de -- --languagetool /pfad/zu/LanguageTool-6.8/languagetool-commandline.jar \
  --output basisfaelle-v4.2.0.json
npm run benchmark:de -- --engine ../localgrammar-4.1.3 --output basisfaelle-v4.1.3.json
```

Die mitgelieferten Beispiele decken bekannte Fehler und korrekte Texte aus Büro, Support und Alltag ab. Für einen unabhängigen Vergleich lässt sich die Datei `fm-test.m2` aus dem Falko-MERLIN-Datenarchiv mitgeben. Der Benchmark verwendet die Korrekturen des ersten Annotators. Die Auswahl mit `--sample` ist deterministisch. Der Bericht enthält Prüfsummen für Daten, Auswahl und Engine. [Daten und Lizenzhinweise](https://github.com/adrianeboyd/boyd-wnut2018) · [Veröffentlichung](https://aclanthology.org/W18-6111/)

```bash
npm run benchmark:de -- --corpus /pfad/zu/fm-test.m2 --sample 350 \
  --languagetool /pfad/zu/LanguageTool-6.8/languagetool-commandline.jar \
  --output falko-merlin-v4.2.0.json
npm run benchmark:de -- --corpus /pfad/zu/fm-test.m2 --sample 350 \
  --engine ../localgrammar-4.1.3 --output falko-merlin-v4.1.3.json
```

Jede Korrektur zählt einmal, wenn Position und Ersatztext nach Entfernen unveränderter Zeichen mit der Annotation übereinstimmen. Der Bericht zählt den ersten Vorschlag separat. Er erfasst auch Hinweise in Sätzen ohne annotierte Fehler sowie lokale Laufzeiten beim Kaltstart und bei geladener Engine. Falko-MERLIN enthält Lernertexte. Eine Annotation kann gültige alternative Korrekturen auslassen. Die Werte gelten für diese Stichprobe und LanguageTool 6.8 Open Source.

## Browserprüfung

Die Playwright-Suite lädt die Erweiterung in ein frisches Browserprofil und verwendet lokale Testseiten. Sie prüft Klicks auf die Wortfläche, Korrekturen und Rückgängig, Modal-Editoren, das Toolbar-Popup, Scrollen, Skalierung und Tabwechsel. Sie überprüft auch, ob eine Korrektur hinter der bisherigen 12.000er-Grenze funktioniert und ob ein Vorschlag nach einer Änderung am Feld verworfen wird. [Befehle für Chromium und Edge](../CONTRIBUTING.md)
