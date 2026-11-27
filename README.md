# Local Grammar Pro

Offline-Grammatikprüfung für Chrome und Chromium. LingoTweaker-WASM 0.2.8 prüft Rechtschreibung, Grammatik und Stil auf Deutsch (Deutschland), Englisch (USA) und Englisch (Großbritannien). Das Archiv enthält den vollständigen Erweiterungscode, die WASM-Engine und beide Sprachpakete.

[![CI](https://github.com/erazer90/Localgrammar/actions/workflows/ci.yml/badge.svg)](https://github.com/erazer90/Localgrammar/actions/workflows/ci.yml)

## Installation

Für die Entwicklung kannst du dieses Repository klonen und direkt den Ordner mit der `manifest.json` als entpackte Erweiterung laden. Nach Codeänderungen die Erweiterung und die Test-Webseite neu laden.

1. Das ZIP-Archiv aus den [Releases](https://github.com/erazer90/Localgrammar/releases) herunterladen und entpacken. Chrome oder Chromium ab Version 123 öffnen.
2. `chrome://extensions` aufrufen und **Entwicklermodus** aktivieren.
3. **Entpackte Erweiterung laden** und den Ordner `LocalGrammarPro` mit der `manifest.json` auswählen.
4. Bereits offene Webseiten neu laden. Zum Ausprobieren in ein mehrzeiliges Web-Textfeld schreiben: „Ich habe gestern ein Film gesehen. Die Gramatik ist schwierig.“
5. Eine Unterstreichung anklicken und einen Vorschlag auswählen. Mit **Alt + Umschalt + G** lässt sich der sichtbare Hinweis in der Nähe des Cursors öffnen. **Esc** schließt die Karte.

Bei einem Update der bisherigen entpackten Installation den Inhalt ihres bestehenden Installationsordners durch die neue Version ersetzen und die Erweiterung über `chrome://extensions` neu laden. So kann Chrome die bisherige Erweiterungs-ID und deren Einstellungen weiterverwenden. Eine entpackte Kopie in einem anderen Ordner erhält in der Regel eine eigene ID.

## Was sich geändert hat

- Die alte Version prüfte mit wenigen regulären Ausdrücken, markierte das ganze Feld und zeigte beim Klick stets den ersten Treffer. LingoTweaker ist jetzt die Haupt-Engine. Die kontextsensitiver gefassten Regex-Regeln mit ihren bisherigen IDs stehen als lokale Basisprüfung bereit.
- Unterstreichungen folgen der konkreten Textstelle in `textarea`, Text- und Suchfeldern sowie zugänglichen `contenteditable`-Editoren. Umbruch, Scrollen und nachgeladene Felder werden berücksichtigt. Korrekturen verwenden Chromes Eingabefunktionen, sodass benachbarte Formatierung und Rückgängig-Verlauf erhalten bleiben können.
- Die Korrekturkarte zeigt mehrere Vorschläge und bietet **Einmal ignorieren**, **Regel ignorieren** und bei Rechtschreibtreffern **Zum Wörterbuch**. Das Wörterbuch blendet passende Rechtschreibtreffer des WASM-Checkers aus. Grammatikregeln bleiben für diese Wörter aktiv.
- Im Erweiterungspopup kannst du die Sprache und die Prüfung pro Hostnamen einstellen. Die Optionsseite verwaltet Wörterbuch, ignorierte Regeln und pausierte Hosts. Hell und Dunkel folgen dem System. Das Kontextmenü **Local Grammar Pro: Auswahl prüfen** öffnet einen lokalen Bericht für den markierten Text.
- Ein gemeinsamer Web Worker lädt die benötigte Sprachvariante bei Bedarf. Die Prüfung beginnt nach einer kurzen Schreibpause. Veraltete Ergebnisse werden verworfen. Die Richtlinie der Erweiterungsseiten erlaubt nur Verbindungen zum eigenen Erweiterungsursprung.

## Grenzen

- Die erste deutsche Prüfung kann je nach Rechner mehrere Sekunden benötigen. Pro Prüfung werden bis zu 12.000 UTF-16-Codeeinheiten am Textanfang und bis zu 120 Hinweise verarbeitet. Für längere Texte kannst du einzelne Abschnitte markieren und per Kontextmenü prüfen.
- Die automatische Erkennung wählt eine Sprache pro Prüfung. Bei kurzen, gemischten oder mehrdeutigen Texten hilft eine feste Sprachauswahl. Die Abdeckung hängt vom LingoTweaker-Port ab und kann vom Java- und Premium-Angebot von LanguageTool abweichen.
- DOM-basierte Editoren wie Gmail oder Notion nutzen dieselbe generische Integration wie andere Websites. Diese Dienste wurden nicht im Livebetrieb getestet. Google Docs rendert den Dokumenttext typischerweise auf einem Canvas. Inline-Markierung und direkte Korrektur des Dokuments stehen dort regulär nicht zur Verfügung. Der Auswahlbericht funktioniert, wenn Chrome den markierten Text im Kontextmenü bereitstellt.
- Auf Chrome-internen Seiten und in passwortgeschützten oder bestimmten sensiblen Formularfeldern läuft die Inline-Prüfung nicht. Bei komplexen Editoren und bei Treffern über Absatzgrenzen kann eine direkte Übernahme fehlen.
- Die Browser-Tests laden die echte MV3-Erweiterung in einem temporären Chromium-Profil. Sie prüfen den WASM-Worker ohne Netzverbindung, Korrekturen in Textfeldern und das Rückgängigmachen formatierter Änderungen.

## Quellcode

| Pfad | Aufgabe |
| --- | --- |
| `engine/` | WASM-Einbindung, Worker, Sprachdaten und Regex-Fallback |
| `content/` | Editorerkennung, Textpositionen, Markierungen und Korrekturen |
| `background.js`, `settings.js` | Nachrichten, Einstellungen und Auswahlprüfung |
| `ui/` | Popup, Optionen und Auswahlbericht |

Die Installation braucht keinen Build-Schritt und keine zusätzlichen Pakete. Die Sprachdaten sind im Lieferumfang. Versionsstand, Prüfsummen, Quellcode und Lizenzhinweise stehen in [engine/vendor/SOURCE.md](engine/vendor/SOURCE.md).

## Entwicklung

Mit Node.js 24 kannst du die Prüfungen und den ZIP-Build lokal ausführen.

```bash
npm ci
npm run check
npm test
npm run build
```

Das installierbare ZIP und seine SHA-256-Prüfsumme landen unter `dist/`. Browser-Tests und Release-Ablauf stehen in der [Beitragsanleitung](https://github.com/erazer90/Localgrammar/blob/main/CONTRIBUTING.md). [Lizenzhinweise](LICENSES.md)
