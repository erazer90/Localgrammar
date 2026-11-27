let worker;
let idleTimer;
let nextId = 0;
const pending = new Map();

function stopWorker() {
  clearTimeout(idleTimer);
  worker?.terminate();
  worker = undefined;
  for (const { reply, timer } of pending.values()) {
    clearTimeout(timer);
    reply(null);
  }
  pending.clear();
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  worker.addEventListener("error", stopWorker);
  worker.addEventListener("messageerror", stopWorker);
  worker.addEventListener("message", ({ data: { id, result } }) => {
    const entry = pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(id);
    entry.reply(result ?? null);
    if (!pending.size) idleTimer = setTimeout(stopWorker, 5 * 60_000);
  });
  return worker;
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.action !== "worker.check" || sender.id !== chrome.runtime.id || sender.tab
      || (sender.url && sender.url !== chrome.runtime.getURL("background.js"))) return;
  clearTimeout(idleTimer);
  try {
    const target = getWorker();
    const id = ++nextId;
    const timer = setTimeout(stopWorker, 25_000);
    pending.set(id, { reply, timer });
    target.postMessage({ id, ...message.payload });
    return true;
  } catch {
    stopWorker();
  }
});
