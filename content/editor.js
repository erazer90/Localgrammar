(() => {
  const MAX_CAPTURE = 12002;
  const TEXT_INPUTS = new Set(["text", "search"]);
  const PRIVATE_AUTOCOMPLETE = /(?:^|\s)(?:username|(?:current|new)-password|one-time-code|cc-\S+)(?:\s|$)/i;

  function isPrivate(element) {
    return element.hasAttribute("data-local-grammar-ignore")
      || PRIVATE_AUTOCOMPLETE.test(element.getAttribute("autocomplete") || "");
  }

  function hasPrivateAncestor(element) {
    for (let node = element; node instanceof Element; node = node.parentElement ?? node.getRootNode().host) {
      if (isPrivate(node)) return true;
    }
    return false;
  }

  function isPlain(editor) {
    return editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement;
  }

  function editorFor(eventOrNode) {
    const target = eventOrNode?.composedPath?.().find(node => node instanceof Element) ?? eventOrNode;
    if (!(target instanceof HTMLElement) || hasPrivateAncestor(target)) return null;
    if (isPlain(target)) {
      if (target.matches(":disabled") || target.readOnly
          || (target instanceof HTMLInputElement && !TEXT_INPUTS.has(target.type))) return null;
      return target;
    }
    if (!target.isContentEditable) return null;
    let editor = target;
    while (editor.parentElement?.isContentEditable) editor = editor.parentElement;
    return editor;
  }

  function focused() {
    let node = document.activeElement;
    while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
    return editorFor(node);
  }

  function languageHint(editor) {
    let element = editor;
    while (element) {
      const lang = element.closest("[lang]")?.getAttribute("lang");
      if (lang) return lang;
      element = element.getRootNode().host;
    }
    return document.documentElement.lang;
  }

  function snapshot(editor) {
    if (isPlain(editor)) return { text: editor.value.slice(0, MAX_CAPTURE), plain: true };

    const segments = [];
    const boundaries = [];
    let text = "";
    let pendingBlock = false;
    let visited = 0;

    function lineBreak(explicit) {
      if (explicit || (text && !text.endsWith("\n"))) {
        boundaries.push(text.length);
        text += "\n";
      }
      pendingBlock = false;
    }

    // Record offsets against the original DOM nodes. Synthetic line breaks keep
    // adjacent paragraphs apart and mark boundaries that must never be replaced.
    function visit(node) {
      if (++visited > 6000 || text.length >= MAX_CAPTURE) return;
      if (node.nodeType === Node.TEXT_NODE) {
        if (!node.data || (pendingBlock && /^(?:\s*\n\s*)$/u.test(node.data))) return;
        if (pendingBlock) lineBreak(false);
        const value = node.data.slice(0, MAX_CAPTURE - text.length);
        if (value) {
          segments.push({ node, start: text.length, end: text.length + value.length });
          text += value;
        }
        return;
      }
      if (!(node instanceof HTMLElement) || node.hidden || /^(SCRIPT|STYLE|TEMPLATE)$/u.test(node.tagName)) return;
      if (isPrivate(node) || node.getAttribute("contenteditable")?.toLowerCase() === "false"
          || /^(IMG|INPUT|IFRAME|HR|VIDEO|CANVAS)$/u.test(node.tagName)) {
        if (text) lineBreak(true);
        return;
      }
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return;
      if (node.tagName === "BR") {
        lineBreak(true);
        return;
      }
      const block = /^(block|list-item|table|flex|grid|flow-root)/u.test(style.display);
      if (block) pendingBlock = true;
      for (let child = node.firstChild; child && visited <= 6000 && text.length < MAX_CAPTURE; child = child.nextSibling) visit(child);
      if (block) pendingBlock = true;
    }

    for (let child = editor.firstChild; child && visited <= 6000 && text.length < MAX_CAPTURE; child = child.nextSibling) visit(child);
    return { text, plain: false, segments, boundaries, incomplete: visited > 6000 };
  }

  function point(segments, offset, preferEnd) {
    let low = 0;
    let high = segments.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (segments[mid].end < offset || (!preferEnd && segments[mid].end === offset)) low = mid + 1;
      else high = mid;
    }
    const segment = segments[low];
    if (segment && segment.start <= offset) return [segment.node, offset - segment.start];
    const previous = segments[low - 1];
    return previous ? [previous.node, previous.end - previous.start] : null;
  }

  function rangeFor(view, start, end) {
    const a = point(view.segments, start, false);
    const b = start === end ? a : point(view.segments, end, true);
    if (!a || !b || !a[0].isConnected || !b[0].isConnected) return null;
    const range = new Range();
    range.setStart(...a);
    range.setEnd(...b);
    return range;
  }

  function canReplace(view, issue) {
    if (view.plain) return true;
    if (issue.count && !view.segments.some(item => item.start <= issue.start && issue.end <= item.end)) return false;
    return !view.boundaries.some(index => index >= issue.start && index < issue.end)
      && !!rangeFor(view, issue.start, issue.end);
  }

  // Combine nearby, compatible edits. A group stays inside a sentence and a
  // single formatted text node so that one native edit can be undone cleanly.
  function groupFor(view, issues, selected) {
    let run = [];
    function finish() {
      if (run.length < 2 || !run.includes(selected)) return null;
      const start = run[0].start;
      const end = run.at(-1).end;
      if (!view.plain && !view.segments.some(item => item.start <= start && end <= item.end)) return null;
      let cursor = start;
      let replacement = "";
      for (const item of run) {
        replacement += view.text.slice(cursor, item.start) + item.suggestions[0];
        cursor = item.end;
      }
      return { start, end, original: view.text.slice(start, end), replacement, count: run.length };
    }
    for (const issue of issues) {
      const [first] = issue.suggestions;
      const reliable = first !== undefined && (issue.suggestions.length === 1 || issue.preferred
        || first.toLowerCase() === issue.original.toLowerCase());
      const previous = run.at(-1);
      if (previous && (!reliable || issue.start < previous.end || issue.end - run[0].start > 90
          || run.length >= 6 || !/^[ \t]*(?:\p{L}{1,12}[ \t]+)?$/u.test(view.text.slice(previous.end, issue.start)))) {
        const group = finish();
        if (group) return group;
        run = [];
      }
      if (reliable) run.push(issue);
    }
    return finish();
  }

  function apply(editor, checkedText, issue, replacement) {
    if (!editor.isConnected || editorFor(editor) !== editor) return false;
    const view = snapshot(editor);
    if (view.text !== checkedText || view.text.slice(issue.start, issue.end) !== issue.original
        || !canReplace(view, issue)) return false;
    editor.focus({ preventScroll: true });
    // Focus handlers in host editors can rebuild their DOM synchronously.
    const latest = snapshot(editor);
    if (latest.text !== checkedText || !canReplace(latest, issue)) return false;

    const { start, end } = issue;
    if (latest.plain) {
      editor.setSelectionRange(start, end);
    } else {
      const selection = editor.getRootNode().getSelection?.() ?? document.getSelection();
      if (!selection) return false;
      selection.removeAllRanges();
      selection.addRange(rangeFor(latest, start, end));
    }

    // Chrome's native editing path keeps undo, formatting and framework input events.
    const command = replacement === "" ? "delete" : "insertText";
    if (document.execCommand(command, false, replacement)) return true;
    if (!latest.plain || editor.value.slice(0, MAX_CAPTURE) !== checkedText) return false;

    const inputType = replacement ? "insertReplacementText" : "deleteContentBackward";
    const event = { bubbles: true, composed: true, inputType, data: replacement };
    if (!editor.dispatchEvent(new InputEvent("beforeinput", { ...event, cancelable: true }))
        || editor.value.slice(0, MAX_CAPTURE) !== checkedText) return false;
    editor.setRangeText(replacement, start, end, "end");
    editor.dispatchEvent(new InputEvent("input", event));
    return true;
  }

  globalThis.LGPEditor = { apply, canReplace, groupFor, editorFor, focused, languageHint, rangeFor, snapshot };
})();
