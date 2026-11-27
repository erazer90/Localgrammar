const fields = ["enabled", "showInline", "language"];
const lists = ["personalDictionary", "ignoredRules", "pausedSites"];
const status = document.getElementById("status");
const element = id => document.getElementById(id);
const collator = new Intl.Collator("de", { sensitivity: "base" });
let rendered = new Map();

function notify(message, error = false) {
  status.toggleAttribute("data-error", error);
  status.textContent = message;
}

function render(settings) {
  for (const key of fields) {
    const input = element(key);
    if (key === "language") input.value = settings[key];
    else input.checked = settings[key];
    input.disabled = false;
  }
  for (const key of lists) {
    const entries = settings[key].slice().sort(collator.compare);
    const previous = rendered.get(key);
    if (previous?.length === entries.length && previous.every((value, index) => value === entries[index])) continue;
    rendered.set(key, entries);
    const list = element(key);
    const focusIndex = Array.from(list.querySelectorAll("button")).indexOf(document.activeElement);
    list.replaceChildren();
    element(`${key}-empty`).hidden = entries.length > 0;
    for (const value of entries) {
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = value;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = key === "ignoredRules" ? "Aktivieren" : "Entfernen";
      remove.setAttribute("aria-label", `${value}: ${remove.textContent}`);
      remove.addEventListener("click", () => save({ key, value, remove: true }));
      item.append(label, remove);
      list.append(item);
    }
    if (focusIndex >= 0) list.querySelectorAll("button")[Math.min(focusIndex, entries.length - 1)]?.focus();
  }
}

async function save(operation) {
  try {
    render(await LGPSettings.update(operation));
    notify("Gespeichert.");
    return true;
  } catch (error) {
    notify(error.message, true);
    LGPSettings.read().then(render).catch(() => {});
    return false;
  }
}

for (const key of fields) {
  const input = element(key);
  input.addEventListener("change", () => save({ key, value: key === "language" ? input.value : input.checked }));
}

element("dictionary-form").addEventListener("submit", async event => {
  event.preventDefault();
  const field = element("words");
  const words = field.value.split(/\r?\n/u).map(word => word.trim().normalize("NFC")).filter(Boolean);
  if (!words.length || words.some(word => !LGPSettings.validWord(word))) {
    field.setCustomValidity("Gib pro Zeile ein Wort mit höchstens 100 Zeichen ein.");
    field.reportValidity();
    return;
  }
  if (await save({ key: "personalDictionary", value: words })) field.value = "";
});
element("words").addEventListener("input", event => event.target.setCustomValidity(""));

element("site-form").addEventListener("submit", async event => {
  event.preventDefault();
  const field = element("hostname");
  const site = LGPSettings.hostname(field.value.trim());
  if (!site) {
    field.setCustomValidity("Gib einen gültigen Hostnamen ein.");
    field.reportValidity();
    return;
  }
  if (await save({ key: "pausedSites", value: site })) field.value = "";
});
element("hostname").addEventListener("input", event => event.target.setCustomValidity(""));

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") LGPSettings.read().then(render).catch(() => {});
});
LGPSettings.read().then(render).catch(() => notify("Einstellungen konnten nicht geladen werden.", true));
