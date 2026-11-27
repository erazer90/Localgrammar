(() => {
  const defaults = Object.freeze({
    enabled: true,
    language: "de",
    showInline: true,
    personalDictionary: [],
    ignoredRules: [],
    pausedSites: []
  });

  function hostname(value) {
    try {
      const url = new URL(value.includes("://") ? value : `https://${value}`);
      return /^https?:$/.test(url.protocol) && !url.username && !url.password
        ? url.hostname.toLowerCase().replace(/\.$/, "") : "";
    } catch {
      return "";
    }
  }

  function wordKey(value) {
    return value.trim().normalize("NFC").replace(/’/gu, "'").toLowerCase();
  }

  function validWord(value) {
    return value.length <= 100 && /^[\p{L}\p{M}][\p{L}\p{M}\d'’\-]*$/u.test(value);
  }

  function strings(values) {
    return Array.isArray(values) ? values.filter(value => typeof value === "string") : [];
  }

  function normalize(stored) {
    let language = stored.language;
    if (language === "de-DE") language = "de";
    if (language === "en-US") language = "en";
    return {
      enabled: stored.enabled !== false,
      showInline: stored.showInline !== false,
      language: ["de", "en", "en-GB", "auto"].includes(language) ? language : "de",
      personalDictionary: strings(stored.personalDictionary),
      ignoredRules: strings(stored.ignoredRules),
      pausedSites: [...new Set(strings(stored.pausedSites).map(hostname).filter(Boolean))]
    };
  }

  const read = async () => normalize(await chrome.storage.local.get(defaults));
  const update = async operation => {
    const result = await chrome.runtime.sendMessage({ action: "settings.update", operation });
    if (!result?.ok) throw new Error("Einstellungen konnten nicht gespeichert werden.");
    return result.settings;
  };

  globalThis.LGPSettings = { read, update, hostname, wordKey, validWord };
})();
