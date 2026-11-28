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

## Ergebnisse für 4.2.0

| Messung | Local Grammar Pro 4.1.3 | Local Grammar Pro 4.2.0 | LanguageTool 6.8 |
| --- | ---: | ---: | ---: |
| Gezielte Beispiele mit korrektem ersten Vorschlag | 33 / 46 | 46 / 46 | 24 / 46 |
| Gezielte korrekte Kontrollsätze mit einem Hinweis | 0 / 50 | 0 / 50 | 0 / 50 |
| Falko-MERLIN mit passendem Vorschlag | 225 / 866 | 228 / 866 | 215 / 866 |
| Falko-MERLIN mit korrektem ersten Vorschlag | 185 / 866 | 188 / 866 | 176 / 866 |
| Rechtschreibung in Falko-MERLIN, erster Vorschlag | 120 / 220 | 120 / 220 | 118 / 220 |
| Grammatik in Falko-MERLIN, erster Vorschlag | 41 / 348 | 43 / 348 | 41 / 348 |
| Zeichensetzung in Falko-MERLIN, erster Vorschlag | 22 / 136 | 23 / 136 | 15 / 136 |
| Falko-MERLIN-Sätze ohne annotierten Fehler mit einem Hinweis | 8 / 77 | 8 / 77 | 4 / 77 |

Die Stichprobe enthält 350 Sätze. Sie zeigt einen Zuwachs bei Grammatik und Zeichensetzung gegenüber 4.1.3. Bei der Rechtschreibung bleibt die Trefferzahl auf dem unabhängigen Test unverändert. Die gezielten Beispiele prüfen bekannte Fälle und werden als Regressionstest ausgeführt. Aussagen über allgemeine Fehlererkennung brauchen zusätzliche unabhängige Texte aus realen Arbeitsabläufen.

## Browserprüfung

Die Playwright-Suite lädt die Erweiterung in ein frisches Browserprofil und verwendet lokale Testseiten. Sie prüft Klicks auf die Wortfläche, Korrekturen und Rückgängig, Modal-Editoren, das Toolbar-Popup, Scrollen, Skalierung und Tabwechsel. Sie überprüft auch, ob eine Korrektur hinter der bisherigen 12.000er-Grenze funktioniert und ob ein Vorschlag nach einer Änderung am Feld verworfen wird. [Befehle für Chromium und Edge](../CONTRIBUTING.md)
