# Changelog

## 4.2.1

- Während eines langsamen Erststarts erscheinen bereits lokale Basishinweise. Die vollständige Prüfung aktualisiert sie, sobald das Sprachpaket bereit ist.
- Bei einer vorübergehenden Ersatzprüfung wird das aktive Feld einmal automatisch erneut geprüft.

## 4.2.0

- Zusätzliche Pflichtkommas an den Grenzen von Relativsätzen und erweiterten Infinitivgruppen.
- Deutsche Kasusprüfung für zusammengesetzte Nomen wie „Kinderarzt“. Mehr passende Verbformen, auch wenn zwischen Subjekt und Verb weitere Satzteile stehen.
- Bei Rechtschreibvorschlägen werden Buchstabendreher und passende Verbformen in kurzen Fragen stärker gewichtet.
- Inline-Prüfung für bis zu 48.000 UTF-16-Codeeinheiten pro Feld. Der Bereich am Cursor wird zuerst geprüft.
- Die Klickposition wird auch dann neu berechnet, wenn eine Website das Textfeld ohne Scroll- oder Größenänderung verschiebt.
- Reproduzierbarer deutscher Qualitätsvergleich und zusätzliche Browser-Tests für Klick, Rückgängig und veraltete Vorschläge.

## 4.1.3

- Deutsche Kasusprüfung nutzt die Wortformen aus dem mitgelieferten Wörterbuch. Sie erkennt Formen wie „mit mein Chef“, „mit ihre Kinder“ und „bei unser neuer Nachbar“.
- Mehr passende Verbformen und Pflichtkommas an erkennbaren Satzgrenzen.
- Kontraktionen wie „am“ und „beim“ helfen, fehlende Großschreibung in „am montag“ und „beim kochen“ zu erkennen.

## 4.1.2

- Zusätzliche Pflichtkommas bei Nebensätzen, Infinitivgruppen und Anreden. Fehlende Zeichen lassen sich direkt einfügen.
- Zusätzliche Grammatikhinweise für häufige falsche Formen von „sein“ und beim Perfekt mit „haben“.
- Deutsche Rechtschreibvorschläge nach Schreibähnlichkeit sortiert. Unicode-Varianten wie zusammengesetzte Umlaute werden beim Prüfen gleich behandelt.
- Anklickbare Korrekturen in modalen Dialogen. Beim Klick werden anstehende Positionsänderungen berücksichtigt.
- Wartende Prüfaufträge können eine laufende Prüfung nicht vorzeitig abbrechen.

## 4.1.1

- Korrekte Großschreibung in Ortsangaben wie „im park“, ohne falschen Vorschlag für „im“.
- Rückkopplung beim Neuzeichnen der Markierungen behoben.
- Popup lädt Einstellungen unabhängig von der Ermittlung der Website.
- GitHub-Startseite mit Logo, Screenshots und kürzerer Installation.

## 4.1.0

- Popup, Einstellungen, Auswahlbericht und Korrekturkarte überarbeitet. Das neue Logo erscheint auch in der Browserleiste.
- Markierte Wörter lassen sich über die gesamte Texthöhe anklicken. Benachbarte Korrekturen können nach Vorschau gemeinsam übernommen werden.
- Zusätzliche deutsche Regeln für häufige Schreibweisen, Großschreibung und feste Wendungen. Stilhinweise und gebündelte Korrekturen sind separat einstellbar.

- Datenschutzbeschreibung und offene Lizenz-/Herkunftsfragen zur Weitergabe dokumentiert; neue automatische Releases bleiben Entwürfe.
- Sensible bearbeitbare Bereiche und deaktivierte Feldgruppen werden von der Inline-Prüfung ausgeschlossen; Websites können Bereiche mit `data-local-grammar-ignore` ausnehmen.
- Automatische Secret-Prüfung der Git-Historie und Ausschluss lokaler Geheimnisdateien aus neuen Commits.

- Reproduzierbarer ZIP-Build mit SHA-256 und Prüfung der eingebundenen Sprachpakete.
- Automatisierte Prüfungen für JavaScript, WASM, das Installationsarchiv und die Chromium-Erweiterung.
- Arbeitsabläufe für Pull Requests, Releases und Abhängigkeitsupdates.

## 4.0.0

- Offline-Prüfung auf Deutsch sowie US- und UK-Englisch mit LingoTweaker-WASM.
- Anklickbare Inline-Markierungen und Korrekturen in Textfeldern und zugänglichen `contenteditable`-Editoren.
- Persönliches Wörterbuch, Website-Pausen, ignorierte Regeln und Kontextmenü für ausgewählten Text.

[Veröffentlichtes Release](https://github.com/erazer90/Localgrammar/releases/tag/v4.0.0)
