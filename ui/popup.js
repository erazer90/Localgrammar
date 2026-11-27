const enabled = document.getElementById("enabled");
const language = document.getElementById("language");
const siteToggle = document.getElementById("site");
const siteLabel = document.getElementById("site-label");
const status = document.getElementById("status");
let site = "";

function render(settings) {
  enabled.checked = settings.enabled;
  enabled.closest(".row").querySelector("small").textContent = settings.enabled ? "Prüft offline auf deinem Gerät." : "Die Prüfung ist pausiert.";
  language.value = settings.language;
  siteToggle.checked = !!site && !settings.pausedSites.includes(site);
}

async function save(operation) {
  status.textContent = "";
  try {
    render(await LGPSettings.update(operation));
  } catch (error) {
    status.textContent = error.message;
    status.dataset.error = "";
    render(await LGPSettings.read());
  }
}

enabled.addEventListener("change", () => save({ key: "enabled", value: enabled.checked }));
language.addEventListener("change", () => save({ key: "language", value: language.value }));
siteToggle.addEventListener("change", () => save({ key: "pausedSites", value: site, remove: siteToggle.checked }));
document.getElementById("options").addEventListener("click", () => chrome.runtime.openOptionsPage());

LGPSettings.read().then(settings => {
  render(settings);
  enabled.disabled = false;
  language.disabled = false;
  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === "local") LGPSettings.read().then(render).catch(() => {});
  });
}).catch(() => {
  status.textContent = "Einstellungen konnten nicht geladen werden.";
  status.dataset.error = "";
});

chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
  site = LGPSettings.hostname(tab?.url ?? "");
  if (site) siteLabel.textContent = site;
  render(await LGPSettings.read());
  siteToggle.disabled = !site;
}).catch(() => {
  siteLabel.textContent = "Website nicht verfügbar";
});
