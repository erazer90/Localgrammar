const enabled = document.getElementById("enabled");
const language = document.getElementById("language");
const siteToggle = document.getElementById("site");
const siteLabel = document.getElementById("site-label");
const status = document.getElementById("status");
let site = "";

function render(settings) {
  enabled.checked = settings.enabled;
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

Promise.all([LGPSettings.read(), chrome.tabs.query({ active: true, currentWindow: true })]).then(([settings, [tab]]) => {
  site = LGPSettings.hostname(tab?.url ?? "");
  if (site) siteLabel.textContent = `${site} prüfen`;
  render(settings);
  enabled.disabled = false;
  language.disabled = false;
  siteToggle.disabled = !site;
  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === "local") LGPSettings.read().then(render);
  });
}).catch(() => {
  status.textContent = "Einstellungen konnten nicht geladen werden.";
  status.dataset.error = "";
});
