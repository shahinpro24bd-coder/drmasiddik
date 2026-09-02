/* CMS content loader — applies saved content to the static page.
   Loaded on every page (live and edit copy).

   No flash of stale content:
   - the requests are started in <head> by cms-boot.js,
   - a device with a local cache paints the cached content immediately,
   - a device with no cache is held back by cms-boot.js until the fresh
     content, font and colour from the database have been applied. */
(function () {
  var page = window.CMS_PAGE || "index";
  var CACHE_KEY = "cms-cache:" + page;
  var SETTINGS_KEY = "cms-settings";
  var boot = window.__CMS_BOOT;
  var gate = window.__CMS_GATE || { release: function () {} };

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
        else if (it.kind === "fontsize") el.style.fontSize = it.value;
        else el.innerHTML = it.value;
      } catch (e) {
        /* ignore a single bad item */
      }
    }
  }

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

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  function read(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /* 1) instant paint from cache (returning devices only) */
  var cached = read(CACHE_KEY);
  if (cached) apply(cached);
  var cachedSettings = read(SETTINGS_KEY);
  if (cachedSettings) applySettings(cachedSettings);

  /* 2) fresh copy from the database (started in <head> by cms-boot.js) */
  function fetchFresh(url) {
    return fetch(url + "&t=" + Date.now(), {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        return (d && d.items) || [];
      })
      .catch(function () {
        return null;
      });
  }

  var contentP =
    (boot && boot.page === page && boot.content) ||
    fetchFresh("/api/public/cms/content?page=" + encodeURIComponent(page));
  var settingsP =
    (boot && boot.settings) || fetchFresh("/api/public/cms/content?page=site-settings");

  var settingsDone = settingsP.then(function (items) {
    if (!items) return;
    var s = toSettings(items);
    applySettings(s);
    save(SETTINGS_KEY, s);
    document.dispatchEvent(new CustomEvent("cms:settings", { detail: s }));
  });

  var contentDone = contentP.then(function (items) {
    if (items) {
      apply(items);
      save(CACHE_KEY, items);
    }
    window.CMS_LOADED = true;
    document.dispatchEvent(new CustomEvent("cms:loaded", { detail: items || [] }));
  });

  /* 3) reveal the page once the saved version is on screen */
  Promise.all([contentDone, settingsDone])
    .then(function () {
      // one frame so the applied styles/text are painted together
      requestAnimationFrame(function () {
        requestAnimationFrame(gate.release);
      });
    })
    .catch(function () {
      gate.release();
    });
})();
