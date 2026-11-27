(() => {
  const marks = new LGPMarks();
  const editorApi = LGPEditor;
  const site = LGPSettings.hostname(location.ancestorOrigins[location.ancestorOrigins.length - 1] || location.href);
  const frame = LGPSettings.hostname(location.origin);
  let settings;
  let state;
  let timer;
  let animation;
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
    state.view = null;
    state.issues = [];
    state.engine = null;
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
    checking = true;
    try {
      const response = await chrome.runtime.sendMessage({
        action: "grammar.check", text: view.text, hint: editorApi.languageHint(current.editor), site
      });
      if (current !== state || revision !== current.revision || !current.editor.isConnected || !enabled()) return;
      const latest = editorApi.snapshot(current.editor);
      if (latest.text !== view.text) {
        invalidate();
        schedule();
        return;
      }
      if (response && !response.disabled && !response.unavailable) {
        current.view = latest;
        current.issues = response.issues;
        current.engine = response.engine;
        render();
      }
    } catch {
      // An extension reload invalidates existing content script messaging.
      marks.clear();
    } finally {
      checking = false;
      if (queued) {
        queued = false;
        clearTimeout(timer);
        schedule(0);
      }
    }
  }

  function render() {
    if (animation) return;
    animation = requestAnimationFrame(() => {
      animation = null;
      if (!enabled() || !state?.editor.isConnected || !state.view) {
        marks.clear();
        return;
      }
      const { editor, view, issues, ignored } = state;
      marks.render(editor, view, issues.filter(issue => !ignored.has(issueKey(issue))), show);
    });
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
    marks.show(issue, anchor, {
      close: () => closeCard(true),
      ignore: () => {
        current.ignored.add(issueKey(issue));
        closeCard(true);
        render();
      },
      ignoreRule: () => save("ignoredRules", issue.id),
      addWord: isWord ? () => save("personalDictionary", dictionaryWord) : null,
      fallback: current.engine === "fallback",
      next: (next, items) => show(next, anchor, items),
      apply: editorApi.canReplace(current.view, issue) ? replacement => {
        if (state !== current || current.view?.text !== checkedText
          || !editorApi.apply(current.editor, checkedText, issue, replacement)) {
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
      editor, revision: 0, view: null, issues: [], ignored: new Set(), ignoredText: ""
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
    if (event.target !== marks.host && marks.card) closeCard();
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
    const editor = state.editor;
    const selection = editor.getRootNode().getSelection?.() ?? document.getSelection();
    const segment = state.view.segments?.find(item => item.node === selection?.anchorNode);
    const caret = state.view.plain ? editor.selectionStart : segment ? segment.start + selection.anchorOffset : 0;
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
  new MutationObserver(() => {
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
