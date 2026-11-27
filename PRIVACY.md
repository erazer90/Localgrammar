# Datenschutz

Stand: 27. November 2026. Diese Beschreibung gilt für den Quellcode dieses Branches und daraus neu gebaute Erweiterungen. Das bereits veröffentlichte ZIP 4.0.0 enthält spätere Änderungen nicht.

## Welche Texte verarbeitet werden

Die aktivierte Inline-Prüfung liest den Anfang des gerade fokussierten, unterstützten Eingabefelds auf HTTP- und HTTPS-Websites, auch in eingebetteten Frames. Die Prüfung verarbeitet höchstens 12.000 UTF-16-Codeeinheiten; für die Begrenzung werden bis zu zwei zusätzliche Einheiten erfasst. Texte und Ergebnisse werden innerhalb der Erweiterung an den lokalen Worker übergeben. Sie können während der Prüfung und für die Anzeige der Hinweise im Arbeitsspeicher liegen.

Passwortfelder, schreibgeschützte und deaktivierte Felder sowie Felder mit sensiblen `autocomplete`-Angaben (Benutzername, Passwort, Einmalcode, Kreditkarte) werden von der Inline-Prüfung ausgeschlossen. Das gilt auch für entsprechend markierte bearbeitbare Bereiche. Eine Website kann ein Feld oder einen übergeordneten Bereich mit dem Attribut `data-local-grammar-ignore` ausschließen, auch innerhalb zugänglicher Shadow-DOMs. Ausgeschlossene Teilbereiche eines Editors werden beim Erfassen des Texts übersprungen.

Diese Erkennung kann unbeschriftete sensible Inhalte nicht zuverlässig erkennen. Pausiere die Erweiterung für vertrauliche Websites oder schalte die Prüfung vor der Eingabe aus. Im Popup lässt sich die Prüfung global und pro Hostnamen deaktivieren; Subdomains werden separat verwaltet. Chrome erlaubt zusätzlich, den Websitezugriff der Erweiterung einzuschränken.

## Lokale Speicherung

In `chrome.storage.local` liegen die Aktivierung, die Sprache, die Inline-Einstellung, das persönliche Wörterbuch, ignorierte Regeln und pausierte Hostnamen. Diese Erweiterung verwendet dafür keine Chrome-Synchronisierung. Wörterbuch und Hostliste können persönliche Informationen enthalten. Einträge können auf der Optionsseite entfernt werden. Beim Entfernen der Erweiterung löscht Chrome deren Erweiterungsspeicher.

Bei **Auswahl prüfen** wird der von Chrome bereitgestellte markierte Text ausdrücklich an die Erweiterung übergeben, auch wenn die automatische Feldprüfung diesen Bereich ausschließt. Bis zu 12.002 UTF-16-Codeeinheiten, der Hostname und ein Zeitstempel werden vorübergehend in `chrome.storage.session` abgelegt. Der Bericht entfernt diese Übergabe beim Lesen. Nach 60 Sekunden wird sie nicht mehr angenommen; ungelesene Einträge werden bei der nächsten Auswahlprüfung bereinigt oder beim Beenden der Browsersitzung von Chrome gelöscht. Das ist keine garantierte Löschung nach genau 60 Sekunden. Ein geöffneter Bericht zeigt die Hinweise bis zum Schließen seines Tabs.

## Netzwerk und Berechtigungen

Der Erweiterungscode enthält keinen externen Prüfdienst, keine Telemetrie und keine Werbung. Engine und Sprachpakete werden aus den mitgelieferten Erweiterungsdateien geladen. Die Sicherheitsrichtlinie der Erweiterungsseiten beschränkt Verbindungen auf den eigenen Erweiterungsursprung. Die Prüfung benötigt kein Konto und keinen API-Schlüssel. Das Verhalten der besuchten Websites, anderer Erweiterungen und von Chrome selbst wird dadurch nicht eingeschränkt.

| Zugriff | Zweck |
| --- | --- |
| Inhaltsskripte auf HTTP/HTTPS, einschließlich Frames | Unterstützte Eingabefelder prüfen und Korrekturen anzeigen |
| `storage` | Einstellungen und die vorübergehende Auswahlübergabe speichern |
| `activeTab` | Den aktuellen Hostnamen für den Website-Schalter im Popup lesen |
| `contextMenus` | Den Befehl zur ausdrücklichen Auswahlprüfung anbieten |
| `offscreen` | Die lokale WASM-Prüfung in einem gemeinsamen Worker ausführen |

Die Erweiterung verändert Text nur beim Auswählen eines Korrekturvorschlags. Prüfe Vorschläge vor der Übernahme; automatisierte Sprachprüfung kann Fehler übersehen oder unpassende Änderungen empfehlen.
