/**
 * Shared site chrome: role-aware navbar and footer partials.
 */
(function () {
  var FOOTER_PATH = "components/footer/footer.html";
  var NAV = {
    host: "components/navbar/navbar-host.html",
    provider: "components/navbar/navbar-provider.html",
    auth: "components/navbar/navbar-auth.html",
  };

  function applyI18n() {
    if (window.HandsI18n && typeof window.HandsI18n.apply === "function") {
      window.HandsI18n.apply();
    }
  }

  function session() {
    if (!window.HandsAuth || typeof window.HandsAuth.getSession !== "function") return null;
    return window.HandsAuth.getSession();
  }

  function dict() {
    if (window.HandsI18n && typeof window.HandsI18n.dict === "function") {
      return window.HandsI18n.dict();
    }
    return {};
  }

  function resolveNavKey(host) {
    var forced = host && host.getAttribute("data-nav");
    if (forced && NAV[forced]) return forced;
    if (document.body.classList.contains("provider-body")) return "provider";
    if (document.body.classList.contains("auth-body")) return "auth";
    if (document.body.classList.contains("admin-body")) return null;
    return "host";
  }

  function fetchHtml(path) {
    return fetch(path).then(function (res) {
      if (!res.ok) throw new Error(path + " " + res.status);
      return res.text();
    });
  }

  function firstElement(html, selector) {
    var wrap = document.createElement("div");
    wrap.innerHTML = String(html || "").trim();
    return (selector && wrap.querySelector(selector)) || wrap.firstElementChild;
  }

  function bindMenu() {
    var menuBtn = document.getElementById("menuBtn");
    var siteNav = document.getElementById("siteNav");
    if (!menuBtn || !siteNav || menuBtn.dataset.bound === "1") return;
    menuBtn.dataset.bound = "1";
    menuBtn.addEventListener("click", function () {
      var open = siteNav.classList.toggle("is-open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    siteNav.addEventListener("click", function (ev) {
      var target = ev.target;
      if (!target || !target.closest) return;
      if (!target.closest("a") && !target.closest("[data-logout]")) return;
      siteNav.classList.remove("is-open");
      menuBtn.setAttribute("aria-expanded", "false");
    });
  }

  function wireLogout(root) {
    if (!root) return;
    root.querySelectorAll("[data-logout]").forEach(function (btn) {
      if (btn.dataset.logoutBound === "1") return;
      btn.dataset.logoutBound = "1";
      btn.addEventListener("click", function () {
        if (window.HandsAuth) window.HandsAuth.logout();
        window.location.href = "index.html";
      });
    });
  }

  function renderAuthActions() {
    var box = document.getElementById("authActions");
    var mobile = document.getElementById("navMobileActions");
    if ((!box && !mobile) || !window.HandsAuth) return;

    var d = dict();
    var user = session();
    var wizardStep = (location.hash || "").match(/step-(\d+)/);
    var nextTarget = location.pathname.indexOf("build.html") >= 0
      ? "build.html" + (wizardStep ? location.hash : "")
      : "";
    var nextLogin = nextTarget
      ? "login.html?next=" + encodeURIComponent(nextTarget)
      : "login.html";
    var nextRegister = nextTarget
      ? "register.html?next=" + encodeURIComponent(nextTarget)
      : "register.html";

    if (!user) {
      if (box) {
        box.innerHTML =
          '<a class="btn btn-text" href="' + nextLogin + '" data-i18n="navLogin">' + (d.navLogin || "Entrar") + "</a>" +
          '<a class="btn btn-ghost" href="' + nextRegister + '" data-i18n="navRegister">' + (d.navRegister || "Crear cuenta") + "</a>";
      }
      if (mobile) {
        mobile.innerHTML =
          '<a href="' + nextLogin + '" data-i18n="navLogin">' + (d.navLogin || "Entrar") + "</a>" +
          '<a href="' + nextRegister + '" data-i18n="navRegister">' + (d.navRegister || "Crear cuenta") + "</a>" +
          '<a class="nav-mobile-cta" href="build.html" data-i18n="navCta">' + (d.navCta || "Reservar") + "</a>";
      }
      applyI18n();
      return;
    }

    var roleLink = "";
    var roleMobile = "";
    if (user.access === "provider") {
      roleLink =
        '<a class="btn btn-text nav-shine" href="provider.html" data-i18n="navProviderJobs">' +
        (d.navProviderJobs || "Mis servicios") +
        "</a>";
      roleMobile =
        '<a href="provider.html" data-i18n="navProviderJobs">' +
        (d.navProviderJobs || "Mis servicios") +
        "</a>";
    } else if (user.access === "admin") {
      roleLink =
        '<a class="btn btn-text nav-shine" href="admin.html" data-i18n="adminPanelEyebrow">' +
        (d.adminPanelEyebrow || "Admin") +
        "</a>";
      roleMobile =
        '<a href="admin.html" data-i18n="adminPanelEyebrow">' +
        (d.adminPanelEyebrow || "Admin") +
        "</a>";
    } else {
      roleLink =
        '<a class="btn btn-text nav-shine" href="bookings.html" data-i18n="navBookings">' +
        (d.navBookings || "Mis reservas") +
        "</a>" +
        '<a class="btn btn-text nav-shine" href="account.html" data-i18n="navAccountLink">' +
        (d.navAccountLink || d.accountTitle || "Cuenta") +
        "</a>";
      roleMobile =
        '<a href="account.html" data-i18n="navAccountLink">' +
        (d.navAccountLink || d.accountTitle || "Cuenta") +
        "</a>" +
        '<a href="bookings.html" data-i18n="navBookings">' +
        (d.navBookings || "Mis reservas") +
        "</a>";
    }

    var hello =
      '<span class="auth-hello">' +
      (d.navAccount || "Hola,") +
      " " +
      String(user.name || "").split(" ")[0] +
      "</span>";

    if (box) {
      box.innerHTML =
        hello +
        roleLink +
        '<button type="button" class="btn btn-ghost btn-shine" data-logout data-i18n="navLogout">' +
        (d.navLogout || "Salir") +
        "</button>";
      wireLogout(box);
    }

    if (mobile) {
      mobile.innerHTML =
        hello +
        roleMobile +
        '<a class="nav-mobile-cta" href="build.html" data-i18n="navCta">' +
        (d.navCta || "Reservar") +
        "</a>" +
        '<button type="button" data-logout data-i18n="navLogout">' +
        (d.navLogout || "Salir") +
        "</button>";
      wireLogout(mobile);
    }

    applyI18n();
  }

  function afterChrome() {
    applyI18n();
    bindMenu();
    renderAuthActions();
    wireLogout(document);
    window.dispatchEvent(new CustomEvent("hands:chrome-ready"));
  }

  function mountNavbar() {
    var host = document.getElementById("site-header");
    if (!host) return Promise.resolve();
    var key = resolveNavKey(host);
    if (!key) return Promise.resolve();

    return fetchHtml(NAV[key])
      .then(function (html) {
        var el = firstElement(html, "header");
        if (!el) return;
        host.replaceWith(el);
      })
      .catch(function (err) {
        console.error("HandsLayout: navbar", err);
      });
  }

  function mountFooter() {
    var host = document.getElementById("site-footer");
    if (!host) return Promise.resolve();

    return fetchHtml(FOOTER_PATH)
      .then(function (html) {
        var footer = firstElement(html, "footer");
        if (!footer) return;
        host.replaceWith(footer);
      })
      .catch(function (err) {
        console.error("HandsLayout: footer", err);
      });
  }

  function init() {
    Promise.all([mountNavbar(), mountFooter()]).then(afterChrome);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.HandsLayout = {
    mountFooter: mountFooter,
    mountNavbar: mountNavbar,
    renderAuthActions: renderAuthActions,
  };
})();
