const summary = document.getElementById("summary");
const results = document.getElementById("results");
const languages = { de: "Deutsch (DE)", en: "Englisch (US)", "en-GB": "Englisch (UK)" };

async function showReport() {
  const id = location.hash.slice(1);
  if (!/^[0-9a-f-]{36}$/u.test(id)) {
    summary.textContent = "Markiere Text auf einer Website und wähle im Kontextmenü „Local Grammar Pro: Auswahl prüfen“.";
    return;
  }
  const key = `selection:${id}`;
  const { [key]: selection } = await chrome.storage.session.get(key);
  await chrome.storage.session.remove(key);
  history.replaceState(null, "", location.pathname);
  if (!selection || Date.now() - selection.created > 60_000) {
    summary.textContent = "Die Auswahl ist abgelaufen. Starte die Prüfung erneut über das Kontextmenü.";
    return;
  }

  const response = await chrome.runtime.sendMessage({
    action: "grammar.check", text: selection.text, site: selection.site
  });
  if (!response || response.unavailable) throw new Error("Check unavailable");
  if (response.disabled) {
    summary.textContent = "Die Prüfung ist global oder für diese Website pausiert.";
    return;
  }
  if (!response.language) {
    summary.textContent = "In der Auswahl wurde kein Text auf Deutsch oder Englisch erkannt.";
    return;
  }
  const count = response.issues.length;
  const finding = count === 0 ? "Keine Hinweise" : count === 1 ? "Ein Hinweis" : `${count} Hinweise`;
  const fallback = response.engine === "fallback" ? " · Lokale Basisprüfung" : "";
  const truncated = response.truncated ? " · Anfang der Auswahl geprüft" : "";
  summary.textContent = `${finding} · ${languages[response.language]}${fallback}${truncated}`;
  for (const issue of response.issues) {
    const item = document.createElement("li");
    if (issue.original.trim()) {
      const original = document.createElement("p");
      original.className = "result-original";
      original.textContent = issue.original;
      item.append(original);
    }
    const message = document.createElement("p");
    message.textContent = issue.message;
    item.append(message);
    if (issue.suggestions.length) {
      const fixes = document.createElement("p");
      fixes.className = "fixes";
      fixes.textContent = issue.suggestions.map(value => value === " " ? "Leerzeichen einfügen" : value || "Entfernen").join(" · ");
      item.append(fixes);
    }
    results.append(item);
  }
}

showReport().catch(() => {
  summary.textContent = "Die Auswahl konnte nicht geprüft werden.";
});
