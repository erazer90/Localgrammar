(() => {
  const styles = new CSSStyleSheet();
  styles.replaceSync(`
    :host { all: initial !important; position: fixed !important; inset: 0 !important;
      z-index: 2147483647 !important; pointer-events: none !important; display: block !important;
      color-scheme: light dark !important; }
    .line { all: unset; box-sizing: border-box; position: fixed; pointer-events: none;
      border-bottom: 2px solid var(--mark); border-radius: 2px; }
    .insertion::after { content: ""; position: absolute; bottom: -2px; left: 3px; height: 5px;
      border-left: 2px solid var(--mark); }
    .line[data-current] { background: color-mix(in srgb, var(--mark) 25%, transparent); }
    .spelling { --mark: #e34b5d; } .grammar { --mark: #477bdf; } .style { --mark: #9b66d6; }
    @media (prefers-color-scheme: dark) {
      .spelling { --mark: #ff7285; } .grammar { --mark: #7ba6ff; } .style { --mark: #c291ff; }
    }
    .card, .card * { box-sizing: border-box; }
    .card {
      --surface: light-dark(#fff, #1b2231); --ink: light-dark(#152037, #edf2ff);
      --muted: light-dark(#4b5770, #b5bfd5); --border: light-dark(#d8dfeb, #414c61);
      --fill: light-dark(#edf3ff, #283854); --accent: light-dark(#194b9d, #b1ccff);
      position: fixed; display: block; pointer-events: auto; color: var(--ink); background: var(--surface);
      border: 1px solid var(--border); border-radius: 16px; padding: 16px 18px;
      width: min(340px, calc(100vw - 16px)); overflow: auto; overscroll-behavior: contain;
      box-shadow: 0 12px 35px #131d4540; font: 14px/1.45 system-ui, sans-serif;
      text-align: start; direction: ltr; overflow-wrap: anywhere;
    }
    .heading, .suggestions, .actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .heading { justify-content: space-between; font-size: 12px; color: var(--muted); font-weight: 650; }
    .category { display: inline-flex; align-items: center; gap: 7px; }
    .category::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--mark); }
    .original { margin: 6px 0 3px; font: 600 19px/1.3 system-ui, sans-serif; white-space: pre-wrap; }
    .message { margin: 0 0 13px; color: var(--muted); }
    .group-label { font-size: 12px; font-weight: 600; color: var(--muted); margin: 14px 0 4px; }
    .card .group-fix { width: 100%; text-align: start; padding: 8px 10px; background: var(--fill); }
    .suggestions button:first-child { color: light-dark(#fff, #12203c); background: light-dark(#2759ad, #a9c7ff); }

    .note { margin: 8px 0; font-size: 12px; color: var(--muted); }
    .actions { margin: 11px 0 0; border-top: 1px solid var(--border); padding-top: 8px; }
    .card button {
      font: inherit; cursor: pointer; border: 1px solid transparent; border-radius: 6px;
      padding: 5px 9px; background: transparent; color: var(--accent); min-height: 29px;
      overflow-wrap: anywhere; max-width: 100%;
    }
    .card button:hover { border-color: var(--border); }
    .card button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    .suggestions button { background: var(--fill); font-weight: 600; }
    .card button:disabled { color: var(--muted); cursor: default; }
    .actions button { font-size: 12px; }
    .mirror { display: block; pointer-events: none; visibility: hidden; position: fixed;
      box-sizing: border-box; border: 0; overflow: hidden; margin: 0; transform-origin: top left; }
  `);

  const mirrorProperties = [
    "font-family", "font-size", "font-style", "font-weight", "font-stretch", "font-variant",
    "font-kerning", "font-feature-settings", "font-variation-settings", "font-optical-sizing",
    "line-height", "letter-spacing", "word-spacing", "text-indent", "text-align", "text-transform",
    "text-rendering", "tab-size", "direction", "unicode-bidi", "padding-top", "padding-bottom",
    "padding-left", "padding-right", "white-space", "overflow-wrap", "word-break", "hyphens", "writing-mode"
  ];

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(label, handler, className) {
    const node = element("button", className, label);
    node.type = "button";
    node.addEventListener("click", handler);
    return node;
  }

  function rect(left, top, right, bottom) {
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  function clientBox(editor) {
    const bounds = editor.getBoundingClientRect();
    const xScale = bounds.width / (editor.offsetWidth || 1);
    const yScale = bounds.height / (editor.offsetHeight || 1);
    const left = bounds.left + editor.clientLeft * xScale;
    const top = bounds.top + editor.clientTop * yScale;
    return { ...rect(left, top, left + editor.clientWidth * xScale, top + editor.clientHeight * yScale), xScale, yScale };
  }

  function clipBox(editor, plain) {
    const viewport = window.visualViewport;
    let clip = rect(viewport?.offsetLeft ?? 0, viewport?.offsetTop ?? 0,
      (viewport?.offsetLeft ?? 0) + (viewport?.width ?? document.documentElement.clientWidth),
      (viewport?.offsetTop ?? 0) + (viewport?.height ?? document.documentElement.clientHeight));
    for (let node = editor; node && node !== document.documentElement;
      node = node.parentElement || node.getRootNode().host) {
      const style = getComputedStyle(node);
      const x = (node === editor && plain) || /(?:hidden|auto|scroll|clip)/u.test(style.overflowX);
      const y = (node === editor && plain) || /(?:hidden|auto|scroll|clip)/u.test(style.overflowY);
      if (x || y) {
        const box = clientBox(node);
        clip = rect(x ? Math.max(clip.left, box.left) : clip.left,
          y ? Math.max(clip.top, box.top) : clip.top,
          x ? Math.min(clip.right, box.right) : clip.right,
          y ? Math.min(clip.bottom, box.bottom) : clip.bottom);
      }
    }
    return clip;
  }

  function fragments(rectangles, clip, insertion) {
    return Array.from(rectangles, box => rect(Math.max(box.left - (insertion ? 4 : 0), clip.left),
      Math.max(box.top, clip.top), Math.min(Math.max(box.right, box.left + (insertion ? 7 : 3)), clip.right),
      Math.min(box.bottom, clip.bottom))).filter(box => box.width >= 2 && box.height >= 4);
  }

  class Marks {
    constructor() {
      this.host = element("local-grammar-pro");
      this.root = this.host.attachShadow({ mode: "closed" });
      this.root.adoptedStyleSheets = [styles];
      this.layer = element("div");
      this.mirror = element("div", "mirror");
      this.mirror.setAttribute("aria-hidden", "true");
      this.root.append(this.layer, this.mirror);
      this.root.addEventListener("keydown", event => {
        if (event.key === "Escape" && this.card) {
          event.stopPropagation();
          event.preventDefault();
          this.onClose();
        }
      });
    }

    clear() {
      this.close();
      this.host.remove();
      this.layer.replaceChildren();
      this.mirror.replaceChildren();
      this.hits = [];
    }

    close() {
      this.card?.remove();
      this.card = null;
      this.current = null;
      this.layer.querySelectorAll("[data-current]").forEach(node => node.removeAttribute("data-current"));
    }

    prepareMirror(editor, text) {
      const bounds = clientBox(editor);
      const style = getComputedStyle(editor);
      for (const property of mirrorProperties) this.mirror.style.setProperty(property, style.getPropertyValue(property));
      Object.assign(this.mirror.style, {
        left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${editor.clientWidth}px`,
        height: `${editor.clientHeight}px`, transform: `scale(${bounds.xScale}, ${bounds.yScale})`
      });
      if (editor instanceof HTMLInputElement) {
        this.mirror.style.whiteSpace = "pre";
        const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
        const paddingTop = parseFloat(style.paddingTop);
        const paddingBottom = parseFloat(style.paddingBottom);
        this.mirror.style.paddingTop = `${Math.max(paddingTop, (editor.clientHeight - lineHeight + paddingTop - paddingBottom) / 2)}px`;
      } else if (editor.wrap.toLowerCase() === "off") {
        this.mirror.style.whiteSpace = "pre";
      }
      const node = document.createTextNode(text);
      // A trailing newline has an empty visual line in the native control.
      this.mirror.replaceChildren(node, document.createTextNode("\u200b"));
      this.mirror.scrollLeft = editor.scrollLeft;
      this.mirror.scrollTop = editor.scrollTop;
      return node;
    }

    render(editor, view, issues) {
      this.hits = [];
      if (!issues.length) {
        this.clear();
        return;
      }
      // Elements outside a modal are inert, regardless of their z-index.
      const parent = editor.closest("dialog:modal") ?? document.documentElement;
      if (this.host.parentNode !== parent) parent.append(this.host);
      const clip = clipBox(editor, view.plain);
      const node = view.plain ? this.prepareMirror(editor, view.text) : null;
      const scrollAnchor = this.anchor;
      const fragment = document.createDocumentFragment();
      let currentBox;

      for (const issue of issues) {
        let range;
        if (node) {
          range = new Range();
          range.setStart(node, issue.start);
          range.setEnd(node, issue.end);
        } else {
          range = LGPEditor.rangeFor(view, issue.start, issue.end);
        }
        if (!range) continue;
        const insertion = issue.start === issue.end;
        for (const box of fragments(range.getClientRects(), clip, insertion)) {
          const hit = { issue, box };
          this.hits.push(hit);
          const mark = element("span", `line ${issue.kind}`);
          if (insertion) mark.classList.add("insertion");
          mark.setAttribute("aria-hidden", "true");
          Object.assign(mark.style, {
            left: `${box.left}px`, top: `${box.top}px`,
            width: `${box.width}px`, height: `${box.height}px`
          });
          if (issue === this.current) {
            mark.dataset.current = "";
            if (!currentBox || Math.abs(box.top - scrollAnchor.top) < Math.abs(currentBox.top - scrollAnchor.top)) currentBox = box;
          }
          fragment.append(mark);
        }
      }
      this.layer.replaceChildren(fragment);
      if (this.card) {
        if (currentBox) this.place(currentBox);
        else this.close();
      }
    }

    show(issue, anchor, handlers, alternatives = [issue]) {
      this.close();
      this.current = issue;
      this.onClose = handlers.close;
      const card = this.card = element("section", "card");
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-label", "Korrekturvorschläge");
      card.tabIndex = -1;

      const categories = { grammar: "Grammatik", spelling: "Rechtschreibung", style: "Stil" };
      const heading = element("div", "heading");
      const close = button("×", handlers.close);
      close.setAttribute("aria-label", "Schließen");
      heading.append(element("span", `category ${issue.kind}`, categories[issue.kind]), close);
      card.append(heading);
      if (issue.original.trim()) card.append(element("p", "original", issue.original));
      card.append(element("p", "message", issue.message));

      if (alternatives.length > 1) {
        const index = alternatives.indexOf(issue);
        const next = button(`Hinweis ${index + 1} von ${alternatives.length} · weiter`,
          () => handlers.next(alternatives[(index + 1) % alternatives.length], alternatives));
        card.append(next);
      }
      if (issue.suggestions.length && handlers.apply) {
        const suggestions = element("div", "suggestions");
        for (const value of issue.suggestions) {
          suggestions.append(button(value === " " ? "Leerzeichen einfügen" : value || "Entfernen", () => handlers.apply(value)));
        }
        card.append(suggestions);
      } else if (issue.suggestions.length) {
        card.append(element("p", "note", `Vorschläge zur manuellen Korrektur: ${issue.suggestions.join(" · ")}`));
      }
      if (handlers.group && handlers.apply) {
        const group = handlers.group;
        card.append(element("p", "group-label", `${group.count} Stellen zusammen korrigieren`),
          button(group.replacement, () => handlers.apply(group.replacement, group), "group-fix"));
      }
      const actions = element("div", "actions");
      actions.append(button("Einmal ignorieren", handlers.ignore), button("Regel ignorieren", handlers.ignoreRule));
      if (handlers.addWord) actions.append(button("Zum Wörterbuch", handlers.addWord));
      card.append(actions);
      if (handlers.fallback) card.append(element("p", "note", "Lokale Basisprüfung aktiv"));
      const feedback = element("div", "note");
      feedback.hidden = true;
      feedback.setAttribute("role", "status");
      card.append(feedback);
      this.feedback = feedback;
      this.root.append(card);
      this.place(anchor);
      card.focus({ preventScroll: true });
    }

    status(message) {
      if (!this.card) return;
      this.feedback.hidden = false;
      this.feedback.textContent = message;
      this.place(this.anchor);
    }

    place(anchor) {
      this.anchor = anchor;
      const viewport = window.visualViewport;
      const leftLimit = (viewport?.offsetLeft ?? 0) + 8;
      const topLimit = (viewport?.offsetTop ?? 0) + 8;
      const right = leftLimit - 16 + (viewport?.width ?? window.innerWidth);
      const bottom = topLimit - 16 + (viewport?.height ?? window.innerHeight);
      this.card.style.maxWidth = `${right - leftLimit}px`;
      this.card.style.maxHeight = `${Math.max(60, bottom - topLimit)}px`;
      const width = this.card.offsetWidth;
      const height = this.card.offsetHeight;
      const placeAbove = anchor.bottom + 7 + height > bottom && anchor.top - topLimit > bottom - anchor.bottom;
      const top = placeAbove ? anchor.top - height - 7 : anchor.bottom + 7;
      this.card.style.left = `${Math.max(leftLimit, Math.min(anchor.left, right - width))}px`;
      this.card.style.top = `${Math.max(topLimit, Math.min(top, bottom - height))}px`;
    }
  }

  globalThis.LGPMarks = Marks;
})();
