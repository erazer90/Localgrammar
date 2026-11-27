# Zu Local Grammar Pro beitragen

## Lokal entwickeln

Voraussetzung für die Entwicklungswerkzeuge ist Node.js 24. Die Erweiterung selbst lässt sich direkt aus dem Checkout in Chrome oder Chromium ab Version 123 laden.

```bash
npm ci
npm run check
npm test
npx playwright install chromium
npm run test:e2e
```

Auf Linux können für Chromium Systembibliotheken nötig sein. `npx playwright install --with-deps chromium` installiert sie auf unterstützten Distributionen. Die Browser-Tests benötigen ein Chromium-Profil, das entpackte Erweiterungen zulässt.

1. Erstelle einen Branch von `main`.
2. Lade den Ordner mit der `manifest.json` auf `chrome://extensions` als entpackte Erweiterung.
3. Lade die Erweiterung und die Test-Webseite nach Änderungen neu.
4. Eröffne einen Pull Request und beschreibe, welches Verhalten sich ändert und wie du es geprüft hast.

`npm run check` prüft JavaScript, Manifestpfade und die Prüfsummen der eingebundenen Engine und Sprachpakete. Die Node-Tests führen die lokale WASM-Engine und die Regex-Ersatzprüfung aus. Playwright prüft die installierte MV3-Erweiterung in Chromium mit einem temporären Profil und lokalen HTML-Editoren. Verwende in Tests und Fehlerberichten erfundene Texte.

Bei einem Update der Engine gehören die Binärdateien, Sprachpakete, Herkunftsangaben und SHA-256-Werte zusammen. [Vendor-Dokumentation](engine/vendor/SOURCE.md)

## Ein Release erstellen

1. Aktualisiere `manifest.json` und den Changelog im selben Pull Request.
2. Führe die Prüfungen aus und baue das ZIP mit `npm run build`. Das Archiv und seine Prüfsumme liegen unter `dist/`.
3. Setze nach dem Merge einen Tag, der exakt zur Manifestversion passt.

```bash
git switch main
git pull --ff-only
git tag -a v4.0.1 -m "Local Grammar Pro 4.0.1"
git push origin v4.0.1
```

Der Release-Workflow prüft den getaggten Stand und veröffentlicht das ZIP zusammen mit `SHA256SUMS`. Ein erneuter Lauf vergleicht ein bereits veröffentlichtes Archiv bytegenau mit dem neuen Build.
