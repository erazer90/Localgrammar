import { checkWithWasm } from "./lingotweaker.js";
import { fallbackCheck } from "./fallback.js";

let useFallbackUntil = 0;
let queue = Promise.resolve();

self.addEventListener("message", ({ data: { id, text, preference, hint, dictionary, ignoredRules } }) => {
  // The same WASM instance and engine cache are shared across queued checks.
  queue = queue.then(async () => {
    if (Date.now() >= useFallbackUntil) {
      try {
        const result = await checkWithWasm(text, preference, hint, dictionary, ignoredRules);
        self.postMessage({ id, result });
        return;
      } catch (error) {
        console.warn("Local Grammar Pro is using its offline fallback.", error.name);
        useFallbackUntil = Date.now() + 30_000;
      }
    }
    self.postMessage({ id, result: fallbackCheck(text, preference, hint, ignoredRules) });
  }).catch(() => self.postMessage({ id }));
});
