/* Shared CMS theme/font engine — used by both the live pages and the editor.
   Recolours EVERY brand-colour reference on the page:
     - all stylesheet rules (including :hover/:focus/:active and media queries)
     - inline style="" attributes (also on nodes added later)
     - gradients, shadows, borders and rgba() values with any alpha
   The original palette is a family of golds; each member is remapped to a
   derived shade of the chosen theme colour so contrast stays intact. */
(function () {
  var BASE_HEX = "#bf9456";
  var BASE_RGB = "191, 148, 86";

  /* every colour in the site's warm-gold hue band is treated as brand colour */
  var BRAND_HUE_MIN = 22;
  var BRAND_HUE_MAX = 50;
  var BRAND_SAT_MIN = 0.18;

  var ICON_GUARD =
    ':not(i):not(svg):not(path):not([class*="fa-"]):not([class*="bi-"]):not(.fa):not(.fas):not(.fab):not(.far)';

  var currentColor = null;
  var observer = null;
  var OBSERVER_OPTIONS = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style"],
  };

  function observeInline() {
    if (observer && document.documentElement) {
      observer.observe(document.documentElement, OBSERVER_OPTIONS);
    }
  }

  /* Theme writes can touch many inline styles at once. Disconnecting while we
     write prevents those changes being queued and processed again by our own
     observer (which could lock up slower devices). */
  function withoutObserving(fn) {
    if (observer) {
      observer.disconnect();
      observer.takeRecords();
    }
    try {
      fn();
    } finally {
      if (observer) {
        observer.takeRecords();
        observeInline();
      }
    }
  }

  /* the theme sheet must always be the LAST stylesheet in the document so its
     rules win over page-level !important overrides */
  function styleEl(id) {
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement("style");
      el.id = id;
    }
    var host = document.body || document.head || document.documentElement;
    if (el.parentNode !== host || el.nextSibling) host.appendChild(el);
    return el;
  }

  function hexToRgb(hex) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function toHex(rgb) {
    return "#" + rgb.map(function (v) { return ("0" + Math.round(v).toString(16)).slice(-2); }).join("");
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    var h = 0, s = 0, l = (mx + mn) / 2, d = mx - mn;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    if (!s) { var v = l * 255; return [v, v, v]; }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    function hue(t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255];
  }

  function shade(hex, amt) {
    return toHex(
      hexToRgb(hex).map(function (v) {
        return Math.max(0, Math.min(255, Math.round(v + amt)));
      }),
    );
  }

  var BASE_HSL = rgbToHsl.apply(null, hexToRgb(BASE_HEX));

  /* colours that are part of the site's brand palette even when their
     saturation/hue falls outside the generic band (they MUST recolour, or the
     page ends up with a mix of the new theme colour and the old gold/orange) */
  var BRAND_LIST = {
    "#bf9456": 1, "#d4a95a": 1, "#f39c12": 1, "#e8ab3a": 1, "#8b6f47": 1,
    "#9a743e": 1, "#b8860b": 1, "#c9a227": 1, "#a67c52": 1, "#deb887": 1,
    "#daa520": 1, "#cd9b4a": 1, "#e0a458": 1, "#d99a2b": 1, "#f5b041": 1,
    "#e67e22": 1, "#d68910": 1, "#7d5a2e": 1, "#6b4f2a": 1,
    /* amber tint scale used for tags/badges */
    "#fffbeb": 1, "#fef3c7": 1, "#fde68a": 1, "#fcd34d": 1, "#fbbf24": 1,
    "#f59e0b": 1, "#d97706": 1, "#b45309": 1, "#92400e": 1, "#78350f": 1,
  };

  function isBrand(rgb) {
    var key = toHex(rgb).toLowerCase();
    if (BRAND_LIST[key] === 1) return true;
    if (BRAND_LIST[key] === 0) return false;
    var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    return (
      hsl[1] >= BRAND_SAT_MIN &&
      hsl[0] >= BRAND_HUE_MIN &&
      hsl[0] <= BRAND_HUE_MAX &&
      hsl[2] > 0.04 &&
      hsl[2] < 0.97 &&
      /* keep pure rating-star / third-party logo yellows untouched */
      !(hsl[1] > 0.95 && hsl[0] >= 44)
    );
  }

  /* map one brand-family colour onto the chosen theme colour, keeping its
     relative lightness/saturation so gradients and hover shades survive */
  function mapColor(rgb, themeHsl) {
    var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    var satRatio = BASE_HSL[1] > 0 ? hsl[1] / BASE_HSL[1] : 1;
    satRatio = Math.max(0.45, Math.min(1.6, satRatio));
    var s = Math.max(0, Math.min(1, Math.min(themeHsl[1] * satRatio, themeHsl[1] + 0.3)));
    var l = Math.max(0, Math.min(1, hsl[2] + (themeHsl[2] - BASE_HSL[2]) * 0.55));
    return hslToRgb(themeHsl[0], s, l).map(Math.round);
  }


  var COLOR_RE = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b|rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*([0-9.%]+)\s*)?\)/g;

  function recolor(text, themeHsl) {
    if (!text) return text;
    COLOR_RE.lastIndex = 0;
    return text.replace(COLOR_RE, function (m, hex, r, g, b, a) {
      var rgb, alphaHex = "";
      if (hex) {
        rgb = hexToRgb(hex);
        if (hex.length === 8) alphaHex = hex.slice(6);
      } else {
        rgb = [parseInt(r, 10), parseInt(g, 10), parseInt(b, 10)];
      }
      if (!isBrand(rgb)) return m;
      var out = mapColor(rgb, themeHsl);
      if (hex) return toHex(out) + alphaHex;
      return a != null && a !== ""
        ? "rgba(" + out.join(", ") + ", " + a + ")"
        : "rgb(" + out.join(", ") + ")";
    });
  }

  function touched(text) {
    if (!text) return false;
    COLOR_RE.lastIndex = 0;
    var m;
    while ((m = COLOR_RE.exec(text))) {
      var rgb = m[1]
        ? hexToRgb(m[1])
        : [parseInt(m[2], 10), parseInt(m[3], 10), parseInt(m[4], 10)];
      if (isBrand(rgb)) { COLOR_RE.lastIndex = 0; return true; }
    }
    return false;
  }


  /* collect the ORIGINAL text of every rule that carries a brand colour.
     The scan is expensive on this site (thousands of rules), so it runs once
     and the result is reused for every colour the editor previews. */
  function collect(cssRules, out) {
    for (var i = 0; i < cssRules.length; i++) {
      var rule = cssRules[i];
      try {
        /* @keyframes: rebuild the whole animation, never emit bare frames */
        if (rule.type === 7 || (rule.cssRules && rule.name && !rule.selectorText)) {
          if (touched(rule.cssText)) out.push(rule.cssText);
          continue;
        }
        if (rule.cssRules && rule.type !== 1) {
          var inner = [];
          collect(rule.cssRules, inner);
          if (inner.length && rule.conditionText != null) {
            var at = rule.type === 4 ? "@media " : "@supports ";
            out.push(at + rule.conditionText + "{" + inner.join("") + "}");
          } else if (inner.length) {
            out.push(inner.join(""));
          }
          continue;
        }
        if (!rule.selectorText || !rule.cssText) continue;
        var text = rule.cssText;
        if (!touched(text)) continue;
        out.push(rule.selectorText + text.slice(text.indexOf("{")));
      } catch (e) {
        /* unreadable (cross-origin) rule */
      }
    }
  }

  var sheetCache = null;
  var sheetCacheCount = 0;

  function brandCss() {
    if (sheetCache !== null) return sheetCache;
    var out = [];
    var sheets = document.styleSheets;
    for (var i = 0; i < sheets.length; i++) {
      var cssRules = null;
      try {
        cssRules = sheets[i].cssRules;
      } catch (e) {
        cssRules = null;
      }
      if (!cssRules) continue;
      var owner = sheets[i].ownerNode;
      if (owner && (owner.id === "cms-theme-style" || owner.id === "cms-font-style")) continue;
      collect(cssRules, out);
    }
    sheetCache = out.join("\n");
    sheetCacheCount = sheets.length;
    return sheetCache;
  }

  /* inline style="" attributes */
  function recolorInline(root, themeHsl) {
    if (!root || !root.querySelectorAll) return;
    var nodes = root.querySelectorAll('[style]');
    var list = root.getAttribute && root.getAttribute("style") ? [root] : [];
    for (var i = 0; i < nodes.length; i++) list.push(nodes[i]);
    for (var j = 0; j < list.length; j++) {
      var el = list[j];
      if (el.closest && el.closest(".cms-panel,.cms-bar,.cms-sw,#cms-login-btn")) continue;
      var orig = el.getAttribute("data-cms-style-orig");
      if (orig == null) {
        orig = el.getAttribute("style") || "";
        if (!touched(orig)) continue;
        el.setAttribute("data-cms-style-orig", orig);
      }
      var next = recolor(orig, themeHsl);
      if (next !== el.getAttribute("style")) el.setAttribute("style", next);
    }
  }

  /* colour-bearing HTML/SVG attributes (fill, stroke, bgcolor, ...) */
  var COLOR_ATTRS = ["fill", "stroke", "stop-color", "flood-color", "bgcolor", "color"];

  function recolorAttrs(root, themeHsl) {
    if (!root || !root.querySelectorAll) return;
    var sel = COLOR_ATTRS.map(function (a) { return "[" + a + "]"; }).join(",");
    var nodes = root.querySelectorAll(sel);
    var list = root.matches && root.matches(sel) ? [root] : [];
    for (var i = 0; i < nodes.length; i++) list.push(nodes[i]);
    for (var j = 0; j < list.length; j++) {
      var el = list[j];
      if (el.closest && el.closest(".cms-panel,.cms-bar,.cms-sw,.cms-fs,#cms-login-btn")) continue;
      for (var k = 0; k < COLOR_ATTRS.length; k++) {
        var a = COLOR_ATTRS[k];
        if (!el.hasAttribute(a)) continue;
        var key = "data-cms-attr-" + a;
        var orig = el.getAttribute(key);
        if (orig == null) {
          orig = el.getAttribute(a) || "";
          if (!touched(orig)) continue;
          el.setAttribute(key, orig);
        }
        var next = recolor(orig, themeHsl);
        if (next !== el.getAttribute(a)) el.setAttribute(a, next);
      }
    }
  }

  function watchInline() {
    if (observer || typeof MutationObserver === "undefined") return;
    observer = new MutationObserver(function (muts) {
      if (!currentColor) return;
      var themeHsl = rgbToHsl.apply(null, hexToRgb(currentColor));
      withoutObserving(function () {
        muts.forEach(function (m) {
          if (m.type === "childList") {
            for (var i = 0; i < m.addedNodes.length; i++) {
              if (m.addedNodes[i].nodeType === 1) {
                recolorInline(m.addedNodes[i], themeHsl);
                recolorAttrs(m.addedNodes[i], themeHsl);
              }
            }
          } else if (m.type === "attributes" && m.target.nodeType === 1) {
            var el = m.target;
            if (el.closest && el.closest(".cms-panel,.cms-bar,.cms-sw,.cms-fs,#cms-login-btn")) return;
            var cur = el.getAttribute("style") || "";
            var known = el.getAttribute("data-cms-style-orig");
            if (known != null && cur === recolor(known, themeHsl)) return;
            if (touched(cur)) {
              el.setAttribute("data-cms-style-orig", cur);
              var next = recolor(cur, themeHsl);
              if (next !== cur) el.setAttribute("style", next);
            }
          }
        });
      });
    });
    observeInline();
  }

  function applyTheme(color) {
    if (!color || !/^#[0-9a-f]{3,6}$/i.test(color)) return;
    currentColor = color;
    var themeHsl = rgbToHsl.apply(null, hexToRgb(color));
    var rgb = hexToRgb(color);
    var dark = shade(color, -30);
    var light = shade(color, 22);
    var out = [
      ":root{" +
        "--bs-primary:" + color + ";" +
        "--bs-primary-rgb:" + rgb.join(",") + ";" +
        "--bs-link-color:" + color + ";" +
        "--bs-link-hover-color:" + dark + ";" +
        "--cms-primary:" + color + ";" +
        "--cms-primary-dark:" + dark + ";" +
        "--cms-primary-light:" + light + ";" +
        "}",
      /* Bootstrap component states that are compiled from the theme colour */
      ".btn-primary{--bs-btn-bg:" + color + ";--bs-btn-border-color:" + color +
        ";--bs-btn-hover-bg:" + dark + ";--bs-btn-hover-border-color:" + dark +
        ";--bs-btn-active-bg:" + dark + ";--bs-btn-active-border-color:" + dark +
        ";--bs-btn-disabled-bg:" + color + ";--bs-btn-disabled-border-color:" + color + ";}",
      ".btn-outline-primary{--bs-btn-color:" + color + ";--bs-btn-border-color:" + color +
        ";--bs-btn-hover-bg:" + color + ";--bs-btn-hover-border-color:" + color +
        ";--bs-btn-active-bg:" + color + ";--bs-btn-active-border-color:" + color + ";}",
      ".text-primary{color:" + color + " !important;}",
      ".bg-primary{background-color:" + color + " !important;}",
      ".border-primary{border-color:" + color + " !important;}",
      "a:hover{color:" + dark + ";}",
    ];

    withoutObserving(function () {
      styleEl("cms-theme-style").textContent =
        out.join("\n") + "\n" + recolor(brandCss(), themeHsl);

      recolorInline(document.documentElement, themeHsl);
      recolorAttrs(document.documentElement, themeHsl);
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", color);
    });
    watchInline();
  }

  function applyFont(font) {
    if (!font) return;
    var id = "cms-font-link";
    var href =
      "https://fonts.googleapis.com/css2?family=" +
      encodeURIComponent(font).replace(/%20/g, "+") +
      ":wght@300;400;500;600;700&display=swap";
    var link = document.getElementById(id);
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.getAttribute("href") !== href) link.setAttribute("href", href);
    styleEl("cms-font-style").textContent =
      "html body" + ICON_GUARD + ",html body " + ICON_GUARD +
      "{font-family:'" + font + "',sans-serif !important;}";
  }

  window.CMS_THEME = {
    baseColor: BASE_HEX,
    baseRgb: BASE_RGB,
    applyTheme: applyTheme,
    applyFont: applyFont,
    shade: shade,
    apply: function (s) {
      if (!s) return;
      if (s.font) applyFont(s.font);
      if (s.color) applyTheme(s.color);
    },
  };

  /* stylesheets that finish loading after the first apply */
  window.addEventListener("load", function () {
    sheetCache = null; /* rescan once every stylesheet is in */
    if (currentColor) applyTheme(currentColor);
  });
})();
