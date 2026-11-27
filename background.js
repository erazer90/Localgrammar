import "./settings.js";
import { fallbackCheck } from "./engine/fallback.js";
import { MAX_TEXT } from "./engine/limits.js";

const offscreen = "engine/offscreen.html";
const menu = "check-selection";
let creatingDocument;
let settingsQueue = Promise.resolve();

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [chrome.runtime.getURL(offscreen)]
  });
  if (contexts.length) return;
  creatingDocument ??= chrome.offscreen.createDocument({
    url: offscreen, reasons: ["WORKERS"],
    justification: "Run the offline proofreading engine in a shared Web Worker."
  }).finally(() => { creatingDocument = undefined; });
  await creatingDocument;
}

async function check(text, hint, settings) {
  const preference = settings.language;
  const ignoredRules = settings.ignoredRules;
  if (typeof text !== "string" || !text.trim()) return { issues: [], engine: "wasm" };
  text = text.slice(0, MAX_TEXT + 2);
  const payload = { text, preference, hint, dictionary: settings.personalDictionary, ignoredRules };
  try {
    await ensureOffscreen();
    const result = await chrome.runtime.sendMessage({ action: "worker.check", payload });
    if (result) return result;
  } catch {
    // The service worker can still run the small bounded fallback without a document.
  }
  return fallbackCheck(text, preference, hint, ignoredRules);
}

async function save({ key, value, remove }) {
  const stored = await LGPSettings.read();
  if (["enabled", "showInline"].includes(key) && typeof value === "boolean") {
    stored[key] = value;
  } else if (key === "language" && ["de", "en", "en-GB", "auto"].includes(value)) {
    stored[key] = value;
  } else if (key === "personalDictionary" && (typeof value === "string" || Array.isArray(value))) {
    const entries = (Array.isArray(value) ? value : [value]).filter(word => typeof word === "string")
      .map(word => word.trim().normalize("NFC")).filter(LGPSettings.validWord);
    const words = new Map(stored[key].map(word => [LGPSettings.wordKey(word), word]));
    for (const word of entries) {
      const normalized = LGPSettings.wordKey(word);
      if (remove) words.delete(normalized);
      else if (!words.has(normalized)) words.set(normalized, word);
    }
    stored[key] = [...words.values()];
  } else if (typeof value === "string" && ["pausedSites", "ignoredRules"].includes(key)) {
    const entry = key === "pausedSites" ? LGPSettings.hostname(value) : value.trim().slice(0, 250);
    if (!entry) throw new Error("Invalid setting");
    const entries = new Set(stored[key]);
    if (remove) entries.delete(entry);
    else entries.add(entry);
    stored[key] = [...entries];
  } else {
    throw new Error("Invalid setting");
  }
  await chrome.storage.local.set({ [key]: stored[key] });
  return stored;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: menu, title: "Local Grammar Pro: Auswahl prüfen", contexts: ["selection"],
      documentUrlPatterns: ["http://*/*", "https://*/*"]
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== menu || !info.selectionText) return;
  const site = LGPSettings.hostname(tab?.url ?? info.pageUrl ?? info.frameUrl ?? "");
  if (!site) return;
  // Session storage is extension-only by default. The report removes its handoff on read.
  void openSelection(info.selectionText, site);
});

async function openSelection(text, site) {
  const id = crypto.randomUUID();
  const key = `selection:${id}`;
  const selection = { text: text.slice(0, MAX_TEXT + 2), site, created: Date.now() };
  try {
    const entries = await chrome.storage.session.get(null);
    const expired = Object.keys(entries).filter(name => name.startsWith("selection:")
      && Date.now() - entries[name].created > 60_000);
    if (expired.length) await chrome.storage.session.remove(expired);
    await chrome.storage.session.set({ [key]: selection });
    await chrome.tabs.create({ url: chrome.runtime.getURL(`ui/selection.html#${id}`) });
  } catch {
    await chrome.storage.session.remove(key).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || !message) return;
  if (message.action === "settings.update") {
    const extensionPage = sender.url?.startsWith(chrome.runtime.getURL("ui/"));
    if (!extensionPage && !["personalDictionary", "ignoredRules"].includes(message.operation?.key)) return;
    const update = settingsQueue.then(() => save(message.operation ?? {}));
    settingsQueue = update.catch(() => {});
    update.then(settings => reply({ ok: true, settings }), () => reply({ ok: false }));
    return true;
  }
  if (message.action !== "grammar.check") return;
  const fromReport = sender.url?.startsWith(chrome.runtime.getURL("ui/selection.html"));
  const inline = !fromReport && !!sender.tab;
  if (!fromReport && !inline) return;
  const site = LGPSettings.hostname(sender.tab?.url || message.site || sender.origin || sender.url || "");
  const frame = inline ? LGPSettings.hostname(sender.origin || sender.url || "") : "";
  const hint = typeof message.hint === "string" ? message.hint.slice(0, 32) : "";
  LGPSettings.read().then(settings => {
    if (!settings.enabled || (inline && !settings.showInline) || settings.pausedSites.includes(site)
        || (frame && settings.pausedSites.includes(frame))) {
      return { disabled: true, issues: [] };
    }
    return check(message.text, hint, settings);
  }).then(reply, () => reply({ unavailable: true, issues: [] }));
  return true;
});
