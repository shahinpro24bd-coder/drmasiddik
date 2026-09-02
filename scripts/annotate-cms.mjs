// One-off / idempotent build helper:
// copies the static site into public/, annotates editable elements with
// data-cms-id attributes, and generates the *2.html edit copies.
import { parse } from "node-html-parser";
import fs from "node:fs";
import path from "node:path";

const PUBLIC_DIR = path.resolve("public");
const PAGES = ["index", "about", "service", "gallery", "contact"];

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "HEAD", "META", "LINK", "TITLE", "SVG", "PATH"]);
const ICON_ONLY = /^(I|SVG)$/;

function annotate(html, page) {
  const root = parse(html, {
    comment: true,
    blockTextElements: { script: true, noscript: true, style: true, pre: true },
  });
  let n = 0;
  const used = new Set(
    root.querySelectorAll("[data-cms-id]").map((e) => e.getAttribute("data-cms-id")),
  );
  const nextId = () => {
    let id;
    do {
      id = `${page}-${++n}`;
    } while (used.has(id));
    used.add(id);
    return id;
  };

  const body = root.querySelector("body") || root;

  const mark = (el, kind) => {
    if (el.getAttribute("data-cms-id")) return;
    el.setAttribute("data-cms-id", nextId());
    el.setAttribute("data-cms-kind", kind);
  };

  const walk = (el) => {
    if (!el || !el.tagName) return;
    const tag = el.tagName.toUpperCase();
    if (SKIP_TAGS.has(tag)) return;

    if (tag === "IMG") {
      mark(el, "image");
      return;
    }

    const style = el.getAttribute("style") || "";
    if (/background(-image)?\s*:\s*[^;]*url\(/i.test(style)) mark(el, "bg");

    if ((tag === "INPUT" || tag === "TEXTAREA") && el.getAttribute("placeholder")) {
      mark(el, "placeholder");
      return;
    }
    if (tag === "INPUT" || tag === "BR" || tag === "HR") return;

    const childEls = el.childNodes.filter((c) => c.nodeType === 1);
    const onlyIcons = childEls.every((c) => ICON_ONLY.test(c.tagName?.toUpperCase() || ""));
    const text = el.textContent.replace(/\s+/g, " ").trim();

    // Pure leaf (or text + icon only): the element itself becomes editable.
    if (childEls.length === 0 || (onlyIcons && childEls.length <= 2)) {
      if (text && el.getAttribute("data-cms-kind") !== "bg") mark(el, "text");
      return;
    }

    // Mixed content: wrap every bare text node so nothing is left uneditable.
    for (const node of [...el.childNodes]) {
      if (node.nodeType !== 3) continue;
      const raw = node.rawText;
      if (!raw || !raw.replace(/\s+/g, " ").trim()) continue;
      const lead = raw.match(/^\s*/)[0];
      const trail = raw.match(/\s*$/)[0];
      const inner = raw.slice(lead.length, raw.length - trail.length);
      const span = parse(
        `${lead}<span data-cms-id="${nextId()}" data-cms-kind="text">${inner}</span>${trail}`,
      );
      el.exchangeChild(node, span);
    }

    for (const child of el.childNodes.filter((c) => c.nodeType === 1)) walk(child);
  };

  for (const child of body.childNodes.filter((c) => c.nodeType === 1)) walk(child);

  return root.toString();
}


function injectScripts(html, page, editor) {
  const tags = [
    `<script>window.CMS_PAGE=${JSON.stringify(page)};</script>`,
    `<script src="/cms/cms-theme.js"></script>`,
    `<script src="/cms/cms-content.js"></script>`,
    editor ? `<script src="/cms/cms-fonts.js"></script>` : "",
    editor ? `<script src="/cms/cms-editor.js"></script>` : "",
  ]
    .filter(Boolean)
    .join("\n");
  if (html.includes("</body>")) return html.replace("</body>", `${tags}\n</body>`);
  return html + tags;
}

for (const page of PAGES) {
  const file = path.join(PUBLIC_DIR, `${page}.html`);
  if (!fs.existsSync(file)) continue;
  const raw = fs.readFileSync(file, "utf8");
  const annotated = annotate(raw, page);
  fs.writeFileSync(file, injectScripts(annotated, page, false));
  fs.writeFileSync(path.join(PUBLIC_DIR, `${page}2.html`), injectScripts(annotated, page, true));
  console.log(`annotated ${page}`);
}
