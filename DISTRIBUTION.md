# Stand der Weitergabe

Stand: 27. November 2026. Technische Prüfungen ersetzen keine Klärung der Nutzungs- und Weitergaberechte.

## Eigener Erweiterungscode und Icons

Der Maintainer hat angegeben, dass das Projekt mit Grok/GPT erstellt wurde. Für den eigenen Erweiterungscode und die Icons ist bisher keine Lizenz erklärt. Die Herkunft aller Bestandteile und die Befugnis, sie unter eine Lizenz zu stellen, sind noch nicht bestätigt. Eine KI-Erzeugung belegt weder die Rechtefreiheit noch eine bestimmte Lizenz.

Vor einer Freigabe zur Nachnutzung müssen Herkunft und mögliche übernommene Bestandteile geprüft und eine passende Lizenz durch eine berechtigte Person festgelegt werden. Dies gilt auch für Icons. Dieses Repository erklärt keine stillschweigende MIT-, GPL- oder andere Lizenz für diese Teile.

## Mitgelieferte Engine und Sprachdaten

| Bestandteil | Dokumentierter Stand | Noch zu beachten |
| --- | --- | --- |
| LingoTweaker-WASM 0.2.8 | LGPL-2.1-or-later; separat austauschbare JS-/WASM-Dateien | Zugehörigen Quellcode, Build-Anleitung, Hinweise und die anwendbaren LGPL-Pflichten bei binärer Weitergabe sicherstellen |
| Deutsche Sprachdaten | Unter anderem CC BY-SA 4.0 und GPL-Lizenzoptionen | Attribution, Lizenztexte, Herkunft sowie gegebenenfalls Quell- bzw. Datenbereitstellung und Share-Alike-Pflichten pro Bestandteil prüfen |
| Englische Sprachdaten | Upstream dokumentiert ungeklärte Herkunft/Lizenznachweise für Hunspell- und Wortlistenbestandteile | Belastbare Nachweise beschaffen oder betroffene Bestandteile durch Daten mit geklärten Rechten ersetzen |

Die vom Upstream-Maintainer in den übernommenen Hinweisen vermerkte „Owner acceptance“ ist dessen dokumentierte Entscheidung über eine Nachweislücke. Sie erteilt keine zusätzlichen Rechte durch die ursprünglichen Rechteinhaber und ist keine Freigabe dieses Projekts. Auch die übrigen Daten sind anhand der per-Datei-Nachweise zu beurteilen. Die unveränderten Upstream-Hinweise betreffen mehr Sprachen als die hier gebündelten deutschen und englischen Pakete.

Quellen: [gebündelte Version und Prüfsummen](engine/vendor/SOURCE.md), [Upstream-Lizenzübersicht](engine/vendor/notices/THIRD_PARTY_NOTICES.md), [Provenienz und Lizenztexte](engine/vendor/notices/README.md), [per-Datei-Manifest von LingoTweaker 0.2.8](https://github.com/fiduswriter/LingoTweaker/blob/v0.2.8/data/manifest.json).

## Releases

Neue automatisch erstellte Releases bleiben als **Entwurf** auf GitHub. Vor der manuellen Veröffentlichung müssen die offenen Rechtefragen geklärt, die erforderlichen Lizenz-/Quellmaterialien beigefügt und Datenschutzbeschreibung sowie Paketinhalt geprüft sein. Der Entwurf schützt nicht den bereits öffentlichen Quellcode, Branches, Tags oder öffentliche CI-Artefakte; diese enthalten die gebündelten Fremddaten weiterhin. Bei fehlenden Weitergaberechten müssen die betroffenen Inhalte ersetzt oder entfernt werden.

Das vorhandene Release `v4.0.0` und das ZIP im Branch `download/v4.0.0` stammen aus einem älteren Stand. Änderungen auf `main` oder einem Pull-Request-Branch aktualisieren sie nicht. Alte Downloads und gegebenenfalls die Historie sind bei einer späteren Bereinigung ausdrücklich mitzubehandeln.
