/* CMS visual editor — only loaded on the *2.html edit copies. */
(function () {
  var page = window.CMS_PAGE || "index";
  var changes = {}; // cms_id -> {cms_id, kind, value}
  var authed = false;

  /* ---------- styles ---------- */
  var css = document.createElement("style");
  css.textContent = [
    ".cms-bar{position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:10px 14px;box-shadow:0 8px 30px rgba(0,0,0,.18);font-family:system-ui,'Hind Siliguri',sans-serif;font-size:14px}",
    ".cms-btn{border:0;border-radius:8px;padding:8px 14px;font-size:14px;cursor:pointer;font-family:inherit}",
    ".cms-btn-save{background:#16a34a;color:#fff}",
    ".cms-btn-out{background:#111827;color:#fff}",
    ".cms-btn-login{position:fixed;left:16px;bottom:16px;z-index:2147483000;background:#111827;color:#fff;border:0;border-radius:10px;padding:10px 16px;font-size:14px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.2);font-family:system-ui,'Hind Siliguri',sans-serif}",
    ".cms-on [data-cms-id]{outline:1px dashed rgba(220,38,70,.55);outline-offset:2px;position:relative}",
    ".cms-on [data-cms-id]:hover{outline:2px solid #dc2646;background:rgba(220,38,70,.05)}",
    ".cms-pencil{position:absolute;z-index:2147482000;width:26px;height:26px;border-radius:50%;background:#dc2646;color:#fff;border:0;cursor:pointer;font-size:13px;line-height:26px;text-align:center;padding:0;box-shadow:0 2px 8px rgba(0,0,0,.3)}",
    "[data-cms-editing]{outline:2px solid #16a34a !important;background:#fff !important;color:#111 !important;min-width:40px}",
    ".cms-modal{position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;font-family:system-ui,'Hind Siliguri',sans-serif}",
    ".cms-card{background:#fff;border-radius:14px;padding:24px;width:320px;box-shadow:0 20px 60px rgba(0,0,0,.35)}",
    ".cms-card h3{margin:0 0 14px;font-size:18px;color:#111}",
    ".cms-card input{width:100%;box-sizing:border-box;margin-bottom:10px;padding:10px;border:1px solid #d4d4d4;border-radius:8px;font-size:14px}",
    ".cms-err{color:#dc2646;font-size:13px;margin-bottom:8px;display:none}",
    ".cms-btn-set{background:#2563eb;color:#fff}",
    ".cms-panel{position:fixed;right:16px;bottom:74px;z-index:2147483500;width:340px;max-height:70vh;overflow:auto;background:#fff;border:1px solid #e5e5e5;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.25);padding:16px;font-family:system-ui,sans-serif;color:#111}",
    ".cms-panel h4{margin:0 0 8px;font-size:15px}",
    ".cms-panel input[type=search]{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #d4d4d4;border-radius:8px;margin-bottom:8px;font-size:13px}",
    ".cms-fontlist{max-height:210px;overflow:auto;border:1px solid #eee;border-radius:8px;margin-bottom:14px}",
    ".cms-fontitem{padding:7px 10px;font-size:15px;cursor:pointer;border-bottom:1px solid #f3f3f3}",
    ".cms-fontitem:hover{background:#f3f4f6}",
    ".cms-fontitem.sel{background:#111827;color:#fff}",
    ".cms-swatches{display:grid;grid-template-columns:repeat(8,1fr);gap:6px}",
    ".cms-sw{width:100%;padding-top:100%;border-radius:6px;cursor:pointer;border:2px solid transparent}",
    ".cms-sw.sel{border-color:#111827;box-shadow:0 0 0 2px #fff inset}",
    ".cms-toast{position:fixed;left:50%;top:20px;transform:translateX(-50%);z-index:2147483600;background:#111827;color:#fff;padding:10px 18px;border-radius:10px;font-family:system-ui,sans-serif;font-size:14px}",
    ".cms-fs{position:absolute;z-index:2147482500;display:flex;gap:4px;background:#111827;border-radius:8px;padding:3px;box-shadow:0 6px 18px rgba(0,0,0,.3)}",
    ".cms-fs button{border:0;border-radius:6px;background:#fff;color:#111;font-family:system-ui,sans-serif;font-size:12px;font-weight:700;padding:4px 9px;cursor:pointer;line-height:1}",
    ".cms-fs button:hover{background:#dc2646;color:#fff}",
  ].join("\n");
  document.head.appendChild(css);

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "cms-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () {
      t.remove();
    }, 2600);
  }

  /* ---------- login ---------- */
  var loginBtn = document.createElement("button");
  loginBtn.className = "cms-btn-login";
  loginBtn.id = "cms-login-btn";
  loginBtn.textContent = "\u2699 \u09b8\u09c7\u099f\u09bf\u0982\u09b8";
  document.body.appendChild(loginBtn);
  loginBtn.addEventListener("click", openLogin);

  function openLogin() {
    var wrap = document.createElement("div");
    wrap.className = "cms-modal";
    wrap.innerHTML =
      '<div class="cms-card"><h3>\u098f\u09a1\u09bf\u099f\u09b0 \u09b2\u0997\u0987\u09a8</h3>' +
      '<div class="cms-err" id="cms-err"></div>' +
      '<input id="cms-user" placeholder="Username" autocomplete="username">' +
      '<input id="cms-pass" type="password" placeholder="Password" autocomplete="current-password">' +
      '<button class="cms-btn cms-btn-save" id="cms-do-login" style="width:100%">\u09b2\u0997\u0987\u09a8</button>' +
      '<button class="cms-btn" id="cms-cancel" style="width:100%;margin-top:8px;background:#f3f4f6;color:#111">\u09ac\u09be\u09a4\u09bf\u09b2</button></div>';
    document.body.appendChild(wrap);
    wrap.querySelector("#cms-cancel").onclick = function () {
      wrap.remove();
    };
    wrap.querySelector("#cms-do-login").onclick = function () {
      var u = wrap.querySelector("#cms-user").value;
      var p = wrap.querySelector("#cms-pass").value;
      fetch("/api/public/cms/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      })
        .then(function (r) {
          return r.json().then(function (d) {
            return { ok: r.ok, d: d };
          });
        })
        .then(function (res) {
          if (!res.ok) {
            var err = wrap.querySelector("#cms-err");
            err.style.display = "block";
            err.textContent = res.d.error || "login failed";
            return;
          }
          wrap.remove();
          enableEditing();
        });
    };
  }

  /* ---------- editing (click directly on any element) ---------- */
  function placePencils() {
    /* no pencils: direct click editing */
  }

  function bindClickEditing() {
    document.addEventListener(
      "click",
      function (e) {
        if (!authed) return;
        if (e.target.closest(".cms-bar,.cms-modal,.cms-btn-login,.cms-toast")) return;
        var el = e.target.closest("[data-cms-id]");
        if (!el) return;
        if (el.getAttribute("data-cms-editing")) return;
        e.preventDefault();
        e.stopPropagation();
        startEdit(el, el.getAttribute("data-cms-kind") || "text");
      },
      true,
    );
  }


  /* ---------- A+ / A- font size buttons on hover ---------- */
  var fsWidget = null;
  var fsTarget = null;

  function hideFs() {
    if (fsWidget) {
      fsWidget.remove();
      fsWidget = null;
      fsTarget = null;
    }
  }

  function showFs(el) {
    if (fsTarget === el && fsWidget) return;
    hideFs();
    fsTarget = el;
    fsWidget = document.createElement("div");
    fsWidget.className = "cms-fs";
    fsWidget.innerHTML = "<button type='button' data-fs='-1'>A\u2212</button><button type='button' data-fs='1'>A+</button>";
    document.body.appendChild(fsWidget);
    var r = el.getBoundingClientRect();
    var top = window.scrollY + r.top - fsWidget.offsetHeight - 6;
    if (top < window.scrollY) top = window.scrollY + r.bottom + 6;
    fsWidget.style.top = top + "px";
    fsWidget.style.left = Math.max(4, window.scrollX + r.left) + "px";

    Array.prototype.forEach.call(fsWidget.querySelectorAll("button"), function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var cur = parseFloat(window.getComputedStyle(el).fontSize) || 16;
        var next = Math.max(8, Math.min(120, cur + 2 * Number(btn.getAttribute("data-fs"))));
        el.style.fontSize = next + "px";
        record(el, "fontsize", next + "px");
      });
      btn.addEventListener("mousedown", function (e) {
        e.preventDefault();
        e.stopPropagation();
      });
    });
    fsWidget.addEventListener("mouseleave", function () {
      setTimeout(function () {
        if (fsTarget && !fsTarget.matches(":hover")) hideFs();
      }, 80);
    });
  }

  function bindFsHover() {
    document.addEventListener("mouseover", function (e) {
      if (!authed) return;
      if (e.target.closest(".cms-fs,.cms-bar,.cms-modal,.cms-panel")) return;
      var el = e.target.closest("[data-cms-id]");
      if (!el) return;
      var kind = el.getAttribute("data-cms-kind") || "text";
      if (kind !== "text") return hideFs();
      showFs(el);
    });
    document.addEventListener("mouseout", function (e) {
      if (!fsTarget) return;
      var to = e.relatedTarget;
      if (to && (fsTarget.contains(to) || (fsWidget && fsWidget.contains(to)))) return;
      setTimeout(function () {
        if (fsTarget && !fsTarget.matches(":hover") && !(fsWidget && fsWidget.matches(":hover"))) hideFs();
      }, 80);
    });
    window.addEventListener("scroll", hideFs, true);
  }

  function record(el, kind, value) {
    var id = el.getAttribute("data-cms-id");
    changes[id] = { cms_id: id, kind: kind, value: value };
    updateBar();
  }

  function startEdit(el, kind) {
    if (kind === "image" || kind === "bg") return pickImage(el, kind);
    if (kind === "placeholder") {
      var next = window.prompt("Placeholder", el.getAttribute("placeholder") || "");
      if (next !== null) {
        el.setAttribute("placeholder", next);
        record(el, kind, next);
      }
      return;
    }
    el.setAttribute("contenteditable", "true");
    el.setAttribute("data-cms-editing", "1");
    el.focus();
    var sel = window.getSelection();
    var range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    var finish = function () {
      el.removeAttribute("contenteditable");
      el.removeAttribute("data-cms-editing");
      record(el, "text", el.innerHTML.trim());
      el.removeEventListener("blur", finish);
      placePencils();
    };
    el.addEventListener("blur", finish);
    el.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") el.blur();
    });
  }

  function pickImage(el, kind) {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var dataUrl = String(reader.result);
        toast("\u0986\u09aa\u09b2\u09cb\u09a1 \u09b9\u099a\u09cd\u099b\u09c7...");
        fetch("/api/public/cms/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mime: file.type, data: dataUrl }),
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (d) {
            if (!d.url) return toast("\u0986\u09aa\u09b2\u09cb\u09a1 \u09ac\u09cd\u09af\u09b0\u09cd\u09a5");
            if (kind === "image") el.setAttribute("src", d.url);
            else el.style.backgroundImage = "url('" + d.url + "')";
            record(el, kind, d.url);
            toast("\u099b\u09ac\u09bf \u09af\u09c1\u0995\u09cd\u09a4 \u09b9\u09df\u09c7\u099b\u09c7");
            placePencils();
          });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }


  /* ---------- settings (font + theme colour) ---------- */
  var settings = {};            // pending settings changes
  var current = {};             // currently applied settings
  var panel = null;

  document.addEventListener("cms:settings", function (e) {
    current = e.detail || {};
  });

  function previewFont(f) {
    if (window.CMS_THEME) window.CMS_THEME.applyFont(f);
  }
  function previewColor(c) {
    if (window.CMS_THEME) window.CMS_THEME.applyTheme(c);
  }

  function toggleSettings() {
    if (panel) {
      panel.remove();
      panel = null;
      return;
    }
    panel = document.createElement("div");
    panel.className = "cms-panel";
    panel.innerHTML =
      '<h4>\u09ab\u09a8\u09cd\u099f (Font)</h4>' +
      '<input type="search" id="cms-font-q" placeholder="Search font...">' +
      '<div class="cms-fontlist" id="cms-fontlist"></div>' +
      '<h4>\u09a5\u09bf\u09ae \u0995\u09be\u09b2\u09be\u09b0 (Theme colour)</h4>' +
      '<div class="cms-swatches" id="cms-swatches"></div>';
    document.body.appendChild(panel);

    var list = panel.querySelector("#cms-fontlist");
    var fonts = window.CMS_FONTS || [];
    var selectedFont = settings.font || current.font || "";

    function renderFonts(q) {
      list.innerHTML = "";
      fonts
        .filter(function (f) {
          return !q || f.toLowerCase().indexOf(q.toLowerCase()) >= 0;
        })
        .forEach(function (f) {
          var d = document.createElement("div");
          d.className = "cms-fontitem" + (f === selectedFont ? " sel" : "");
          d.textContent = f;
          d.style.fontFamily = "'" + f + "', sans-serif";
          d.onclick = function () {
            selectedFont = f;
            settings.font = f;
            previewFont(f);
            renderFonts(panel.querySelector("#cms-font-q").value);
            updateBar();
          };
          list.appendChild(d);
        });
    }
    renderFonts("");
    panel.querySelector("#cms-font-q").oninput = function () {
      renderFonts(this.value);
    };

    var sw = panel.querySelector("#cms-swatches");
    var selectedColor = settings.color || current.color || (window.CMS_THEME && window.CMS_THEME.baseColor);
    (window.CMS_COLORS || []).forEach(function (c) {
      var b = document.createElement("div");
      b.className = "cms-sw" + (c.toLowerCase() === String(selectedColor).toLowerCase() ? " sel" : "");
      b.style.background = c;
      b.title = c;
      b.setAttribute("data-cms-color", c);
      b.onclick = function () {
        selectedColor = c;
        settings.color = c;
        previewColor(c);
        Array.prototype.forEach.call(sw.children, function (n) {
          n.classList.remove("sel");
        });
        b.classList.add("sel");
        updateBar();
      };
      sw.appendChild(b);
    });
  }

  /* ---------- save bar ---------- */
  var bar;
  function updateBar() {
    if (!bar) return;
    var n = Object.keys(changes).length + Object.keys(settings).length;
    bar.querySelector("#cms-count").textContent = n + " \u09aa\u09b0\u09bf\u09ac\u09b0\u09cd\u09a4\u09a8";
  }

  function enableEditing() {
    authed = true;
    document.documentElement.classList.add("cms-on");
    loginBtn.style.display = "none";
    bar = document.createElement("div");
    bar.className = "cms-bar";
    bar.innerHTML =
      '<span id="cms-count">0 \u09aa\u09b0\u09bf\u09ac\u09b0\u09cd\u09a4\u09a8</span>' +
      '<button class="cms-btn cms-btn-set" id="cms-settings">\u2699 \u09b8\u09c7\u099f\u09bf\u0982\u09b8</button>' +
      '<button class="cms-btn cms-btn-save" id="cms-save">\u09b8\u09c7\u09ad \u0995\u09b0\u09c1\u09a8</button>' +
      '<button class="cms-btn cms-btn-out" id="cms-logout">\u09b2\u0997 \u0986\u0989\u099f</button>';
    document.body.appendChild(bar);
    bar.querySelector("#cms-save").onclick = save;
    bar.querySelector("#cms-settings").onclick = toggleSettings;
    bar.querySelector("#cms-logout").onclick = logout;
    bindClickEditing();

    toast("\u098f\u09a1\u09bf\u099f \u09ae\u09cb\u09a1 \u099a\u09be\u09b2\u09c1");
  }

  function save() {
    var items = Object.keys(changes).map(function (k) {
      return changes[k];
    });
    var settingItems = Object.keys(settings).map(function (k) {
      return { cms_id: k, kind: "setting", value: settings[k] };
    });
    if (settingItems.length) {
      fetch("/api/public/cms/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: "site-settings", items: settingItems }),
      })
        .then(function (r) {
          return r.json().then(function (d) {
            return { ok: r.ok, d: d };
          });
        })
        .then(function (res) {
          if (!res.ok) return toast("\u09b8\u09c7\u099f\u09bf\u0982\u09b8 \u09b8\u09c7\u09ad \u09ac\u09cd\u09af\u09b0\u09cd\u09a5");
          for (var k in settings) current[k] = settings[k];
          settings = {};
          try {
            localStorage.setItem("cms-settings", JSON.stringify(current));
          } catch (e) {}
          updateBar();
          toast("\u09b8\u09c7\u099f\u09bf\u0982\u09b8 \u09b8\u09c7\u09ad \u09b9\u09df\u09c7\u099b\u09c7 \u2713");
        });
    }
    if (!items.length) return settingItems.length ? undefined : toast("\u0995\u09cb\u09a8\u09cb \u09aa\u09b0\u09bf\u09ac\u09b0\u09cd\u09a4\u09a8 \u09a8\u09c7\u0987");
    fetch("/api/public/cms/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: page, items: items }),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          return { ok: r.ok, d: d };
        });
      })
      .then(function (res) {
        if (!res.ok) return toast("\u09b8\u09c7\u09ad \u09ac\u09cd\u09af\u09b0\u09cd\u09a5: " + (res.d.error || ""));
        changes = {};
        updateBar();
        toast("\u09b8\u09c7\u09ad \u09b9\u09df\u09c7\u099b\u09c7 \u2713");
      });
  }

  function logout() {
    fetch("/api/public/cms/logout", { method: "POST" }).then(function () {
      location.reload();
    });
  }

  // resume an existing session
  fetch("/api/public/cms/login", { cache: "no-store" })
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      if (d && d.authenticated && !authed) enableEditing();
    })
    .catch(function () {});
})();
