// Shared CMS helpers used by the /api/public/cms/* server routes.
// No module-scope node:* imports: this file is reachable from the route tree.

const FALLBACK_URL = "https://yyocyvzyhhgfrngrxzhh.supabase.co";
const FALLBACK_KEY = "sb_publishable_CkkVe0a4-bFvkGn7e39F_g_3uJPv7Au";

/** Strips markdown/quotes/whitespace that people accidentally paste into env vars. */
function clean(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/^`+|`+$/g, "")
    .replace(/^["']|["']$/g, "")
    .replace(/^\[.*?\]\((.*?)\)$/, "$1")
    .trim();
}

export function supabaseUrl(): string {
  const v = clean(process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"]);
  if (/^https?:\/\/[^\s]+$/i.test(v)) return v.replace(/\/+$/, "");
  return FALLBACK_URL;
}

export function supabaseKey(): string {
  const v = clean(process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]);
  if (v.length > 20 && !/\s/.test(v)) return v;
  return FALLBACK_KEY;
}

export function dbSecret(): string {
  return clean(process.env["CMS_DB_SECRET"]) || "lovable-cms-db-secret-2026";
}

export function adminUser(): string {
  return clean(process.env["CMS_ADMIN_USER"]) || "admin";
}

export function adminPassword(): string {
  return clean(process.env["CMS_ADMIN_PASSWORD"]) || "admin123";
}

function sessionSecret(): string {
  return clean(process.env["CMS_SESSION_SECRET"]) || dbSecret() + "|session";
}

export function restHeaders(): Record<string, string> {
  const key = supabaseKey();
  return {
    apikey: key,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/* ---------------- session cookie (HMAC signed) ---------------- */

const enc = new TextEncoder();

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const SESSION_COOKIE = "cms_session";

export async function createSessionToken(hours = 12): Promise<string> {
  const payload = `${adminUser()}.${Date.now() + hours * 3600_000}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const idx = token.lastIndexOf(".");
  if (idx < 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if ((await hmac(payload)) !== sig) return false;
  const exp = Number(payload.split(".").pop());
  return Number.isFinite(exp) && exp > Date.now();
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export async function requireSession(request: Request): Promise<boolean> {
  return verifySessionToken(readCookie(request, SESSION_COOKIE));
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...(init.headers || {}),
    },
  });
}

/* ---------------- surgical HTML patching ---------------- */

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

function findElement(html: string, cmsId: string) {
  const marker = `data-cms-id="${cmsId}"`;
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const tagStart = html.lastIndexOf("<", at);
  if (tagStart < 0) return null;
  const tagEnd = html.indexOf(">", at);
  if (tagEnd < 0) return null;
  const tagName = (html.slice(tagStart + 1, tagEnd).match(/^([a-zA-Z0-9-]+)/) || [])[1];
  return { tagStart, tagEnd, tagName: (tagName || "").toLowerCase() };
}

/** Finds the index just before the element's matching closing tag. */
function findInnerEnd(html: string, tagName: string, from: number): number {
  const open = new RegExp(`<${tagName}(\\s|>|/)`, "gi");
  const close = new RegExp(`</${tagName}\\s*>`, "gi");
  let depth = 1;
  let cursor = from;
  while (depth > 0) {
    close.lastIndex = cursor;
    const c = close.exec(html);
    if (!c) return -1;
    open.lastIndex = cursor;
    let o = open.exec(html);
    while (o && o.index < c.index) {
      depth++;
      open.lastIndex = o.index + 1;
      o = open.exec(html);
    }
    depth--;
    cursor = c.index + c[0].length;
    if (depth === 0) return c.index;
  }
  return -1;
}

function replaceAttr(tag: string, attr: string, value: string): string {
  const re = new RegExp(`(\\s${attr}\\s*=\\s*)(["'])(.*?)\\2`, "i");
  const escaped = value.replace(/"/g, "&quot;");
  if (re.test(tag)) return tag.replace(re, `$1"${escaped}"`);
  return tag.replace(/\/?>$/, (m) => ` ${attr}="${escaped}"${m}`);
}

export type CmsItem = { cms_id: string; kind: string; value: string };

/** Applies items to an HTML string with minimal string surgery. */
export function patchHtml(html: string, items: CmsItem[]): string {
  let out = html;
  for (const item of items) {
    const found = findElement(out, item.cms_id);
    if (!found) continue;
    const { tagStart, tagEnd, tagName } = found;
    const openTag = out.slice(tagStart, tagEnd + 1);

    if (item.kind === "image") {
      out = out.slice(0, tagStart) + replaceAttr(openTag, "src", item.value) + out.slice(tagEnd + 1);
      continue;
    }
    if (item.kind === "placeholder") {
      out =
        out.slice(0, tagStart) + replaceAttr(openTag, "placeholder", item.value) + out.slice(tagEnd + 1);
      continue;
    }
    if (item.kind === "fontsize") {
      const style = (openTag.match(/\sstyle\s*=\s*(["'])(.*?)\1/i) || [])[2] || "";
      const cleaned = style.replace(/(^|;)\s*font-size\s*:[^;]*/gi, "$1").replace(/;;+/g, ";");
      const nextStyle = `${cleaned}${cleaned.trim() && !cleaned.trim().endsWith(";") ? ";" : ""}font-size:${item.value}`;
      out = out.slice(0, tagStart) + replaceAttr(openTag, "style", nextStyle) + out.slice(tagEnd + 1);
      continue;
    }
    if (item.kind === "bg") {
      const style = (openTag.match(/\sstyle\s*=\s*(["'])(.*?)\1/i) || [])[2] || "";
      const nextStyle = /background(-image)?\s*:/i.test(style)
        ? style.replace(/(background(?:-image)?\s*:\s*)([^;]*)/i, (_m, p1: string, p2: string) =>
            /url\(/i.test(p2)
              ? p1 + p2.replace(/url\((['"]?)(.*?)\1\)/i, `url('${item.value}')`)
              : `${p1}${p2} url('${item.value}')`,
          )
        : `${style}${style && !style.trim().endsWith(";") ? ";" : ""}background-image:url('${item.value}')`;
      out = out.slice(0, tagStart) + replaceAttr(openTag, "style", nextStyle) + out.slice(tagEnd + 1);
      continue;
    }

    // text (inner HTML)
    if (VOID_TAGS.has(tagName)) continue;
    const innerEnd = findInnerEnd(out, tagName, tagEnd + 1);
    if (innerEnd < 0) continue;
    out = out.slice(0, tagEnd + 1) + item.value + out.slice(innerEnd);
  }
  return out;
}

/** Patches both the live page and its edit copy on disk (best effort). */
export async function patchFiles(page: string, items: CmsItem[]): Promise<string[]> {
  const patched: string[] = [];
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    for (const file of [`${page}.html`, `${page}2.html`]) {
      const full = path.join(process.cwd(), "public", file);
      if (!fs.existsSync(full)) continue;
      const html = fs.readFileSync(full, "utf8");
      const next = patchHtml(html, items);
      if (next !== html) {
        fs.writeFileSync(full, next);
        patched.push(file);
      }
    }
  } catch {
    // Read-only filesystem (e.g. serverless) — the database stays the source of truth.
  }
  return patched;
}

/* ---------------- site settings (font + theme colour) ---------------- */

const BASE_HEX = /#bf9456/gi;
const BASE_RGB = /rgb\(\s*191\s*,\s*148\s*,\s*86\s*\)/gi;
const THEME_START = "<!--CMS-THEME-START-->";
const THEME_END = "<!--CMS-THEME-END-->";

function hexToRgbTuple(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Brace-aware scan: keeps only the rules (and their at-rule wrappers) that
 *  reference the original brand colour, rewritten with the new colour. */
export function recolorCss(css: string, color: string): string {
  const rgb = `rgb(${hexToRgbTuple(color).join(", ")})`;
  const out: string[] = [];

  const scan = (text: string): string[] => {
    const kept: string[] = [];
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf("{", i);
      if (open < 0) break;
      // find matching close
      let depth = 1;
      let j = open + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === "{") depth++;
        else if (text[j] === "}") depth--;
        j++;
      }
      const prelude = text.slice(i, open).trim();
      const body = text.slice(open + 1, j - 1);
      i = j;
      if (!prelude) continue;
      if (prelude.startsWith("@")) {
        if (/^@(media|supports)/i.test(prelude)) {
          const inner = scan(body);
          if (inner.length) kept.push(`${prelude}{${inner.join("")}}`);
        }
        continue;
      }
      if (BASE_HEX.test(body) || BASE_RGB.test(body)) {
        BASE_HEX.lastIndex = 0;
        BASE_RGB.lastIndex = 0;
        kept.push(`${prelude}{${body.replace(BASE_HEX, color).replace(BASE_RGB, rgb)}}`);
      }
      BASE_HEX.lastIndex = 0;
      BASE_RGB.lastIndex = 0;
    }
    return kept;
  };

  out.push(...scan(css));
  return out.join("\n");
}

function themeBlock(font: string, color: string, css: string): string {
  const parts: string[] = [THEME_START];
  if (font) {
    const fam = encodeURIComponent(font).replace(/%20/g, "+");
    parts.push(
      `<link id="cms-static-font" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${fam}:wght@300;400;500;600;700&display=swap">`,
    );
  }
  const guard =
    ':not(i):not(svg):not(path):not([class*="fa-"]):not([class*="bi-"]):not(.fa):not(.fas):not(.fab):not(.far)';
  const rules: string[] = [];
  if (color) {
    rules.push(`:root{--bs-primary:${color};--bs-primary-rgb:${hexToRgbTuple(color).join(",")};}`);
    rules.push(css);
  }
  if (font) {
    rules.push(
      `html body${guard},html body ${guard}{font-family:'${font}',sans-serif !important;}`,
    );
  }
  parts.push(`<style id="cms-static-theme">\n${rules.join("\n")}\n</style>`);
  parts.push(THEME_END);
  return parts.join("\n");
}

/** Writes the chosen font/colour into every static HTML file (best effort). */
export async function patchSettingsFiles(items: CmsItem[]): Promise<string[]> {
  const patched: string[] = [];
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "public");
    const map: Record<string, string> = {};
    for (const it of items) map[it.cms_id] = it.value;

    // merge with whatever is already applied so a font-only save keeps the colour
    const font = map["font"] || "";
    const color = map["color"] || "";

    let css = "";
    if (color) {
      for (const sheet of ["css/bootstrap.min.css", "css/style.css"]) {
        const full = path.join(dir, sheet);
        if (fs.existsSync(full)) css += recolorCss(fs.readFileSync(full, "utf8"), color) + "\n";
      }
    }

    const block = themeBlock(font, color, css);
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".html")) continue;
      const full = path.join(dir, file);
      const html = fs.readFileSync(full, "utf8");
      let next: string;
      const s = html.indexOf(THEME_START);
      const e = html.indexOf(THEME_END);
      if (s >= 0 && e > s) next = html.slice(0, s) + block + html.slice(e + THEME_END.length);
      else if (html.includes("</head>")) next = html.replace("</head>", `${block}\n</head>`);
      else continue;
      if (next !== html) {
        fs.writeFileSync(full, next);
        patched.push(file);
      }
    }
  } catch {
    // read-only filesystem — the database remains the source of truth
  }
  return patched;
}
