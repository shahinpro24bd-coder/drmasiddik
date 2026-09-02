/* CMS content loader — applies saved content to the static page.
   Loaded on every page (live and edit copy). No flash of stale content:
   the localStorage cache is applied synchronously before first paint. */
(function () {
  var page = window.CMS_PAGE || "index";
  var CACHE_KEY = "cms-cache:" + page;

  function apply(items) {
    if (!items || !items.length) return;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var el = document.querySelector('[data-cms-id="' + it.cms_id + '"]');
      if (!el) continue;
      try {
        if (it.kind === "image") el.setAttribute("src", it.value);
        else if (it.kind === "placeholder") el.setAttribute("placeholder", it.value);
        else if (it.kind === "bg") el.style.backgroundImage = "url('" + it.value + "')";
        else el.innerHTML = it.value;
      } catch (e) {
        /* ignore a single bad item */
      }
    }
  }

  var SETTINGS_KEY = "cms-settings";

  function toSettings(items) {
    var s = {};
    for (var i = 0; i < (items || []).length; i++) {
      if (items[i].cms_id === "font") s.font = items[i].value;
      if (items[i].cms_id === "color") s.color = items[i].value;
    }
    return s;
  }

  function applySettings(s) {
    window.CMS_SETTINGS = s;
    if (window.CMS_THEME) window.CMS_THEME.apply(s);
  }

  // 1) instant paint from cache
  try {
    var cached = localStorage.getItem(CACHE_KEY);
    if (cached) apply(JSON.parse(cached));
    var cachedSettings = localStorage.getItem(SETTINGS_KEY);
    if (cachedSettings) applySettings(JSON.parse(cachedSettings));
  } catch (e) {}

  // 1b) fresh site settings (font + theme colour)
  fetch("/api/public/cms/content?page=site-settings&t=" + Date.now(), { cache: "no-store" })
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      var s = toSettings(d && d.items);
      applySettings(s);
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
      } catch (e) {}
      document.dispatchEvent(new CustomEvent("cms:settings", { detail: s }));
    })
    .catch(function () {});

  // 2) fresh copy from the database (cache-busted, never cached)
  fetch("/api/public/cms/content?page=" + encodeURIComponent(page) + "&t=" + Date.now(), {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  })
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      var items = (d && d.items) || [];
      apply(items);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(items));
      } catch (e) {}
      window.CMS_LOADED = true;
      document.dispatchEvent(new CustomEvent("cms:loaded", { detail: items }));
    })
    .catch(function () {
      window.CMS_LOADED = true;
      document.dispatchEvent(new CustomEvent("cms:loaded", { detail: [] }));
    });
})();
