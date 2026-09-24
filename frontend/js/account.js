/**
 * Host account page — view/edit profile name and property access details.
 */
(function () {
  var form = document.getElementById("accountForm");
  if (!form || !window.HandsAuth || !window.HandsValidate) return;

  var V = window.HandsValidate;
  var inComplex = null;
  var needsAuth = null;

  function t(key, fallback) {
    return (window.HandsI18n && window.HandsI18n.dict()[key]) || fallback || key;
  }

  function showMsg(text, ok) {
    var el = document.getElementById("accountMsg");
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || "";
    el.classList.toggle("is-error", !ok);
  }

  function setChip(btn, on) {
    if (!btn) return;
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function paintComplex() {
    setChip(document.getElementById("accComplexYes"), inComplex === true);
    setChip(document.getElementById("accComplexNo"), inComplex === false);
    var box = document.getElementById("accComplexFields");
    if (box) box.hidden = inComplex !== true;
    var err = document.getElementById("accComplexError");
    if (err) err.textContent = "";
    if (inComplex !== true) {
      needsAuth = null;
      setChip(document.getElementById("accNeedsAuthYes"), false);
      setChip(document.getElementById("accNeedsAuthNo"), false);
    }
  }

  function paintNeedsAuth() {
    setChip(document.getElementById("accNeedsAuthYes"), needsAuth === true);
    setChip(document.getElementById("accNeedsAuthNo"), needsAuth === false);
    var err = document.getElementById("accNeedsAuthError");
    if (err) err.textContent = "";
  }

  function fillForm(session) {
    var p = window.HandsAuth.normalizeProperty(session.property);
    document.getElementById("accName").value = session.name || "";
    document.getElementById("accEmail").value = session.email || "";
    document.getElementById("accAddress").value = p.address || "";
    document.getElementById("accUnit").value = p.unit || "";
    document.getElementById("accNeighborhood").value = p.neighborhood || "";
    document.getElementById("accPhone").value = p.phone || "";
    document.getElementById("accAccess").value = p.accessNotes || "";
    document.getElementById("accComplexName").value = p.complexName || "";
    document.getElementById("accComplexTower").value = p.complexTower || "";
    document.getElementById("accComplexApt").value = p.complexApt || "";
    inComplex = typeof session.property === "object" && session.property
      ? !!p.inComplex
      : null;
    if (session.property && (p.address || p.phone)) inComplex = !!p.inComplex;
    needsAuth = p.inComplex ? !!p.needsAuth : null;
    paintComplex();
    paintNeedsAuth();
  }

  function init() {
    return window.HandsAuth.ready().then(function () {
      var session = window.HandsAuth.getSession();
      if (!session) {
        window.location.href = "login.html?next=" + encodeURIComponent("account.html");
        return;
      }
      if (session.access !== "host") {
        if (session.access === "admin") window.location.href = "admin.html";
        else if (session.access === "provider") window.location.href = "provider.html";
        else window.location.href = "index.html";
        return;
      }
      session = window.HandsAuth.refreshSession() || session;
      fillForm(session);
      if (window.HandsI18n) window.HandsI18n.apply();
    });
  }

  document.getElementById("accComplexYes").addEventListener("click", function () {
    inComplex = true;
    paintComplex();
  });
  document.getElementById("accComplexNo").addEventListener("click", function () {
    inComplex = false;
    paintComplex();
  });
  document.getElementById("accNeedsAuthYes").addEventListener("click", function () {
    needsAuth = true;
    paintNeedsAuth();
  });
  document.getElementById("accNeedsAuthNo").addEventListener("click", function () {
    needsAuth = false;
    paintNeedsAuth();
  });

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    showMsg("", true);

    var nameOk = V.personName(document.getElementById("accName").value);
    document.getElementById("accNameError").textContent = nameOk.ok ? "" : nameOk.error;

    if (inComplex === null) {
      document.getElementById("accComplexError").textContent = t(
        "valComplexRequired",
        "Indica si la propiedad está en un conjunto residencial."
      );
    }

    if (inComplex === true && needsAuth === null) {
      document.getElementById("accNeedsAuthError").textContent = t(
        "valNeedsAuthRequired",
        "Indica si se requiere autorización en portería."
      );
    }

    var propertyPayload = {
      address: document.getElementById("accAddress").value,
      unit: document.getElementById("accUnit").value,
      neighborhood: document.getElementById("accNeighborhood").value,
      phone: document.getElementById("accPhone").value,
      inComplex: inComplex,
      complexName: document.getElementById("accComplexName").value,
      complexTower: document.getElementById("accComplexTower").value,
      complexApt: document.getElementById("accComplexApt").value,
      needsAuth: needsAuth === true,
      accessNotes: document.getElementById("accAccess").value,
    };

    if (!nameOk.ok || inComplex === null || (inComplex === true && needsAuth === null)) {
      showMsg(t("valFormFix", "Revisa los campos marcados."), false);
      return;
    }

    window.HandsAuth.updateProfile({ name: document.getElementById("accName").value })
      .then(function (profileResult) {
        if (!profileResult.ok) {
          showMsg(profileResult.message || t("valFormFix"), false);
          return null;
        }
        return window.HandsAuth.updateProperty(propertyPayload);
      })
      .then(function (propertyResult) {
        if (!propertyResult) return;
        if (!propertyResult.ok) {
          showMsg(propertyResult.message || t("valFormFix"), false);
          return;
        }
        fillForm(window.HandsAuth.getSession());
        showMsg(t("accountSaveOk", "Cambios guardados."), true);
        if (window.HandsI18n) window.HandsI18n.apply();
      });
  });

  init();
})();
