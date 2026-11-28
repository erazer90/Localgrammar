// Only the running check may time out the worker. Time spent waiting in the
// queue must not restart a healthy worker or reload the dictionaries.
const waiting = [];
const MAX_WAITING = 8;
let worker;
let active;
let idleTimer;
let nextId = 0;

function complete(entry, result = null) {
  clearTimeout(entry.timer);
  entry.reply(result);
}

function stopWorker() {
  clearTimeout(idleTimer);
  worker?.terminate();
  worker = undefined;
  if (active) complete(active);
  active = undefined;
  for (const entry of waiting.splice(0)) complete(entry);
}

function getWorker() {
  if (worker) return worker;
  const target = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  const onError = () => {
    if (worker === target) stopWorker();
  };
  target.addEventListener("error", onError);
  target.addEventListener("messageerror", onError);
  target.addEventListener("message", ({ data: { id, result } }) => {
    if (worker !== target || active?.id !== id) return;
    complete(active, result ?? null);
    active = undefined;
    dispatch();
  });
  worker = target;
  return worker;
}

function dispatch() {
  if (active) return;
  const entry = waiting.shift();
  if (!entry) {
    idleTimer = setTimeout(stopWorker, 15 * 60_000);
    return;
  }
  clearTimeout(entry.timer);
  active = entry;
  // Compiling WASM and loading the initial language pack cost extra time.
  entry.timer = setTimeout(stopWorker, worker ? 45_000 : 120_000);
  try {
    getWorker().postMessage({ id: entry.id, ...entry.payload });
  } catch {
    stopWorker();
  }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.action !== "worker.check" || sender.id !== chrome.runtime.id || sender.tab
      || (sender.url && sender.url !== chrome.runtime.getURL("background.js"))) return;
  if (waiting.length >= MAX_WAITING) {
    reply(null);
    return;
  }
  clearTimeout(idleTimer);
  const entry = { id: ++nextId, payload: message.payload, reply };
  entry.timer = setTimeout(() => {
    waiting.splice(waiting.indexOf(entry), 1);
    complete(entry);
  }, 30_000);
  waiting.push(entry);
  dispatch();
  return true;
});
