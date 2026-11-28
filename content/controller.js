(() => {
  const marks = new LGPMarks();
  const editorApi = LGPEditor;
  const site = LGPSettings.hostname(location.ancestorOrigins[location.ancestorOrigins.length - 1] || location.href);
  const frame = LGPSettings.hostname(location.origin);
  let settings;
  let state;
  let timer;
  let animation = null;
  let press;
  let checking = false;
  let queued = false;

  function enabled() {
    return settings?.enabled && settings.showInline
      && !settings.pausedSites.includes(site) && !settings.pausedSites.includes(frame);
  }

  const issueKey = issue => JSON.stringify([issue.id, issue.start, issue.end, issue.original]);

  function closeCard(focusEditor = false) {
    marks.close();
    if (focusEditor && state?.editor.isConnected) state.editor.focus({ preventScroll: true });
  }

  function invalidate() {
    if (!state) return;
    state.revision++;
    state.retried = false;
    state.view = null;
    state.issues = [];
    marks.clear();
  }

  function schedule(delay = 330) {
    clearTimeout(timer);
    if (!enabled() || !state || state.composing) return;
    timer = setTimeout(check, delay);
  }

  async function check() {
    if (!enabled() || !state?.editor.isConnected || state.composing) return;
    if (checking) {
      queued = true;
      return;
    }
    const current = state;
    if (editorApi.editorFor(current.editor) !== current.editor) {
      activate(null);
      return;
    }
    const view = editorApi.snapshot(current.editor);
    if (!view.text.trim() || view.incomplete) return;
    if (current.ignoredText !== view.text) {
      current.ignoredText = view.text;
      current.ignored.clear();
    }
    const revision = current.revision;
    const hint = editorApi.languageHint(current.editor);
    const caret = editorApi.caretOffset(current.editor, view);
    const distance = section => Math.max(section.start - caret, caret - section.end + 1, 0);
    const sections = editorApi.checkSections(view.text).sort((a, b) => distance(a) - distance(b));
    const findings = [];
    let previewTimer;
    let previewPending = true;
    let usedFallback = false;
    checking = true;
    try {
      for (const section of sections) {
        if (!section.text.trim()) continue;
        const key = JSON.stringify([hint, section.text]);
        const cached = current.cache.get(key);
        if (!cached && !current.view && previewPending) {
          previewTimer = setTimeout(async () => {
            try {
              const preview = await chrome.runtime.sendMessage({ action: "grammar.preview", text: section.text, hint, site });
              if (!previewPending || current !== state || current.revision !== revision || !enabled()
                  || !current.editor.isConnected || !preview?.issues?.length) return;
              const latest = editorApi.snapshot(current.editor);
              if (latest.incomplete || latest.text !== view.text) return;
              current.view = latest;
              current.issues = sectionIssues(preview, section, view.text.length);
              render();
            } catch { /* The full check can still complete independently. */ }
          }, 1500);
        }
        const response = cached ?? await chrome.runtime.sendMessage({
          action: "grammar.check", text: section.text, hint, site
        });
        previewPending = false;
        clearTimeout(previewTimer);
        if (current !== state || revision !== current.revision || !current.editor.isConnected || !enabled()) return;
        const latest = cached && current.view ? current.view : editorApi.snapshot(current.editor);
        if (latest.incomplete || latest.text !== view.text) {
          invalidate();
          schedule();
          return;
        }
        if (!response || response.disabled || response.unavailable) return;
        if (!cached && response.engine === "wasm") {
          if (current.cache.size >= 48) current.cache.delete(current.cache.keys().next().value);
          current.cache.set(key, response);
        }
        usedFallback ||= response.engine === "fallback";
        findings.push(...sectionIssues(response, section, view.text.length));
        current.view = latest;
        current.issues = findings.toSorted((a, b) => a.start - b.start || a.end - b.end);
        render();
      }
      if (usedFallback && !current.retried) {
        current.retried = true;
        schedule(31_000);
      }
    } catch {
      // An extension reload invalidates existing content script messaging.
      marks.clear();
    } finally {
      previewPending = false;
      clearTimeout(previewTimer);
      checking = false;
      if (queued) {
        queued = false;
        clearTimeout(timer);
        schedule(0);
      }
    }
  }

  function sectionIssues(response, section, length) {
    const issues = [];
    for (const issue of response.issues) {
      const start = section.offset + issue.start;
      const end = section.offset + issue.end;
      if (start < section.start || start > section.end || (start === section.end && section.end !== length)) continue;
      issues.push({ ...issue, start, end, fallback: response.engine === "fallback" });
    }
    return issues;
  }

  function draw() {
    animation = null;
    if (!enabled() || !state?.editor.isConnected || !state.view) {
      marks.clear();
      return;
    }
    const { editor, view, issues, ignored } = state;
    marks.render(editor, view, issues.filter(issue => !ignored.has(issueKey(issue))));
  }

  function render() {
    animation ??= requestAnimationFrame(draw);
  }

  function show(issue, anchor, alternatives) {
    const current = state;
    if (!current?.view || !enabled()) return;
    const checkedText = current.view.text;
    if (editorApi.snapshot(current.editor).text !== checkedText) {
      invalidate();
      schedule(0);
      return;
    }
    const dictionaryWord = issue.original.normalize("NFC").trim();
    const isWord = issue.kind === "spelling" && LGPSettings.validWord(dictionaryWord);
    const save = async (key, value) => {
      try {
        const updated = await LGPSettings.update({ key, value });
        if (state === current && marks.current === issue) closeCard(true);
        syncSettings(updated);
      } catch {
        if (marks.current === issue) marks.status("Konnte nicht speichern.");
      }
    };
    const group = settings.groupSuggestions ? editorApi.groupFor(current.view,
      current.issues.filter(item => !current.ignored.has(issueKey(item))), issue) : null;
    marks.show(issue, anchor, {
      close: () => closeCard(true),
      ignore: () => {
        current.ignored.add(issueKey(issue));
        closeCard(true);
        render();
      },
      ignoreRule: () => save("ignoredRules", issue.id),
      addWord: isWord ? () => save("personalDictionary", dictionaryWord) : null,
      fallback: issue.fallback,
      next: (next, items) => show(next, anchor, items),
      group,
      apply: editorApi.canReplace(current.view, issue) ? (replacement, target = issue) => {
        if (state !== current || current.view?.text !== checkedText
          || !editorApi.apply(current.editor, checkedText, target, replacement)) {
          marks.status("Das Feld wurde geändert oder der Editor hat die Korrektur abgelehnt.");
          if (state === current && editorApi.snapshot(current.editor).text !== checkedText) {
            setTimeout(() => {
              if (state === current) {
                invalidate();
                schedule(0);
              }
            }, 550);
          }
          return;
        }
        invalidate();
        schedule(0);
      } : null
    }, alternatives);
    render();
  }

  const changes = new MutationObserver(records => {
    if (!state?.editor.isConnected || editorApi.editorFor(state.editor) !== state.editor) {
      activate(editorApi.focused());
      return;
    }
    if (state.view && !records.some(record => record.attributeName === "lang")) {
      const view = editorApi.snapshot(state.editor);
      if (!view.incomplete && view.text === state.view.text) {
        state.view = view;
        render();
        return;
      }
    }
    invalidate();
    schedule();
  });

  const resized = new ResizeObserver(render);

  function activate(editor) {
    if (state?.editor === editor || (!state && !editor)) return;
    clearTimeout(timer);
    marks.clear();
    changes.disconnect();
    resized.disconnect();
    state = editor && enabled() ? {
      editor, revision: 0, view: null, issues: [], ignored: new Set(), ignoredText: "", cache: new Map()
    } : null;
    if (!state) return;
    changes.observe(editor, {
      subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ["contenteditable", "hidden", "readonly", "disabled", "type", "lang", "class", "style", "autocomplete", "data-local-grammar-ignore"]
    });
    resized.observe(editor);
    schedule(30);
  }

  function syncSettings(updated) {
    const unchanged = settings && JSON.stringify(updated) === JSON.stringify(settings);
    settings = updated;
    if (unchanged) return;
    if (!enabled()) {
      activate(null);
    } else if (state) {
      if (document.activeElement === marks.host) closeCard(true);
      state.cache.clear();
      invalidate();
      schedule(0);
    } else {
      activate(editorApi.focused());
    }
  }

  document.addEventListener("focusin", event => {
    if (event.target !== marks.host) activate(editorApi.editorFor(event));
  }, true);
  document.addEventListener("focusout", () => {
    queueMicrotask(() => {
      if (document.activeElement === marks.host || !document.hasFocus()) return;
      activate(editorApi.focused());
    });
  }, true);
  document.addEventListener("pointerdown", event => {
    press = event.button === 0 && state?.view && editorApi.editorFor(event) === state.editor
      ? { x: event.clientX, y: event.clientY, editor: state.editor } : null;
    if (event.target !== marks.host && marks.card) closeCard();
  }, true);
  document.addEventListener("pointermove", event => {
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 3) press = null;
  }, { capture: true, passive: true });
  document.addEventListener("pointercancel", () => { press = null; }, true);
  // A click inside an existing selection can leave it selected (e.g. after
  // undo). Distinguish drags by the pointer gesture, not the selection length.
  document.addEventListener("click", event => {
    const start = press;
    press = null;
    if (!start || !state?.view || start.editor !== state.editor || event.button !== 0 || event.detail < 1
        || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey
        || editorApi.editorFor(event) !== state.editor) return;
    // Host pages can reposition an editor without a resize or scroll event.
    // Recompute rectangles before hit-testing any committed click.
    if (animation !== null) cancelAnimationFrame(animation);
    draw();
    const hits = marks.hits.filter(({ box }) => event.clientX >= box.left && event.clientX <= box.right
      && event.clientY >= box.top && event.clientY <= box.bottom)
      .sort((a, b) => Number(b.issue.start === b.issue.end) - Number(a.issue.start === a.issue.end));
    if (!hits.length) return;
    const current = state;
    const revision = current.revision;
    // Chromium can restore textarea focus as the default action of this click.
    // Open afterwards so the card keeps keyboard focus, including after undo.
    setTimeout(() => {
      if (state === current && current.revision === revision
          && (editorApi.focused() === current.editor || document.activeElement === marks.host)) {
        show(hits[0].issue, hits[0].box, [...new Set(hits.map(hit => hit.issue))]);
      }
    }, 0);
  }, true);
  document.addEventListener("input", event => {
    const editor = editorApi.editorFor(event);
    if (!editor || !enabled()) return;
    if (state?.editor !== editor) {
      if (editorApi.focused() !== editor) return;
      activate(editor);
    }
    invalidate();
    if (!event.isComposing) schedule();
  }, true);
  document.addEventListener("compositionstart", event => {
    if (!state || editorApi.editorFor(event) !== state.editor) return;
    state.composing = true;
    invalidate();
    clearTimeout(timer);
  }, true);
  document.addEventListener("compositionend", event => {
    if (!state || editorApi.editorFor(event) !== state.editor) return;
    state.composing = false;
    schedule();
  }, true);
  document.addEventListener("keydown", event => {
    if (!state?.view || event.isComposing || event.target === marks.host
        || !event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey || event.code !== "KeyG") return;
    const caret = editorApi.caretOffset(state.editor, state.view);
    const distance = ({ issue }) => Math.max(issue.start - caret, caret - issue.end, 0);
    const hit = [...(marks.hits || [])].sort((a, b) => distance(a) - distance(b))[0];
    if (hit) {
      event.preventDefault();
      show(hit.issue, hit.box);
    }
  }, true);
  document.addEventListener("scroll", render, { capture: true, passive: true });
  window.addEventListener("scroll", render, { passive: true });
  window.addEventListener("resize", render, { passive: true });
  window.visualViewport?.addEventListener("resize", render, { passive: true });
  window.visualViewport?.addEventListener("scroll", render, { passive: true });
  document.fonts?.addEventListener("loadingdone", render);
  // Delegated editor events handle newly mounted fields without scanning the page.
  new MutationObserver(records => {
    if (records.every(record => record.target === marks.host || marks.host.contains(record.target)
        || (record.type === "childList" && [...record.addedNodes, ...record.removedNodes]
          .every(node => node === marks.host)))) return;
    if (state && (!state.editor.isConnected || editorApi.editorFor(state.editor) !== state.editor)) activate(editorApi.focused());
    else if (state?.view) render();
  }).observe(document.documentElement, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ["autocomplete", "data-local-grammar-ignore", "disabled"]
  });

  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === "local") LGPSettings.read().then(syncSettings).catch(() => {});
  });
  LGPSettings.read().then(syncSettings).catch(() => {});
})();
