/**
 * Login and registration page controllers.
 *
 * Wires live HandsValidate bindings, preserves a safe `next` redirect after
 * auth, and blocks open redirects (absolute URLs / path traversal).
 * Runs only on login.html / register.html (auth-body pages).
 */
(function () {
  var V = window.HandsValidate;
  var bindings = [];

  function applyI18n() {
    window.HandsI18n.apply();
    bindings.forEach(function (b) {
      b.refresh();
    });
  }

  document.querySelectorAll(".lang-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      localStorage.setItem("hands-lang", btn.getAttribute("data-lang"));
      applyI18n();
    });
  });

  function nextValue() {
    return new URLSearchParams(window.location.search).get("next") || "";
  }

  function withNext(url) {
    var next = nextValue();
    if (!next) return url;
    return url + (url.indexOf("?") === -1 ? "?" : "&") + "next=" + encodeURIComponent(next);
  }

  /**
   * Post-login destination: honor relative `next` when safe; never follow
   * protocol-relative or absolute URLs. Admin/provider next require matching access.
   */
  function homeFor(user) {
    if (user && user.access === "admin") return "admin.html";
    if (user && user.access === "provider") return "provider.html";
    return "index.html";
  }

  function redirectAfterAuth(user) {
    var next = nextValue();
    var isAdmin = user && user.access === "admin";
    var isProvider = user && user.access === "provider";
    var asksAdmin =
      next === "admin.html" ||
      (next && next.indexOf("admin.html") === 0);
    var asksProvider =
      next === "provider.html" ||
      (next && next.indexOf("provider.html") === 0);

    if (asksAdmin) {
      window.location.href = isAdmin ? "admin.html" : homeFor(user);
      return;
    }
    if (asksProvider) {
      window.location.href = isProvider ? "provider.html" : homeFor(user);
      return;
    }
    // Reject absolute / scheme-based redirects (open-redirect hardening).
    if (next && next.charAt(0) !== "/" && next.indexOf("://") === -1) {
      window.location.href = next;
      return;
    }
    window.location.href = homeFor(user);
  }

  // Already signed in on an auth page → skip the form.
  if (window.HandsAuth && window.HandsAuth.isLoggedIn()) {
    if (document.body.classList.contains("auth-body")) {
      redirectAfterAuth(window.HandsAuth.getSession());
      return;
    }
  }

  function showFormMsg(el, text) {
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || "";
  }

  function firstInvalid(form) {
    var invalid = form.querySelector(".is-invalid");
    if (invalid) invalid.focus();
  }

  /* --- Login --- */
  var loginForm = document.getElementById("loginForm");
  if (loginForm) {
    var emailInput = document.getElementById("loginEmail");
    var passInput = document.getElementById("loginPassword");
    var emailBind = V.bind(emailInput, document.getElementById("loginEmailError"), function () {
      return V.email(emailInput.value);
    });
    var passBind = V.bind(passInput, document.getElementById("loginPasswordError"), function () {
      return V.loginPassword(passInput.value);
    });
    bindings.push(emailBind, passBind);

    loginForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var emailOk = emailBind.validate();
      var passOk = passBind.validate();
      var msg = document.getElementById("loginMsg");
      if (!emailOk || !passOk) {
        showFormMsg(msg, V.t("valFormFix"));
        firstInvalid(loginForm);
        return;
      }
      window.HandsAuth.login(emailInput.value, passInput.value).then(function (result) {
        if (!result.ok) {
          showFormMsg(msg, result.message || V.t("loginInvalid"));
          return;
        }
        redirectAfterAuth(result.user);
      });
    });
  }

  /* --- Registration --- */
  var registerForm = document.getElementById("registerForm");
  if (registerForm) {
    var nameInput = document.getElementById("regName");
    var emailInput = document.getElementById("regEmail");
    var passInput = document.getElementById("regPassword");
    var confirmInput = document.getElementById("regConfirm");
    var addressInput = document.getElementById("regAddress");
    var unitInput = document.getElementById("regUnit");
    var neighborhoodInput = document.getElementById("regNeighborhood");
    var phoneInput = document.getElementById("regPhone");
    var accessInput = document.getElementById("regAccess");
    var complexFields = document.getElementById("regComplexFields");
    var complexNameInput = document.getElementById("regComplexName");
    var complexTowerInput = document.getElementById("regComplexTower");
    var complexAptInput = document.getElementById("regComplexApt");
    var complexError = document.getElementById("regComplexError");
    var needsAuthError = document.getElementById("regNeedsAuthError");
    var inComplex = null;
    var needsAuth = null;

    var nameBind = V.bind(nameInput, document.getElementById("regNameError"), function () {
      return V.personName(nameInput.value);
    });
    var emailBind = V.bind(emailInput, document.getElementById("regEmailError"), function () {
      var result = V.email(emailInput.value);
      if (!result.ok) return result;
      if (window.HandsAuth.findByEmail(emailInput.value)) {
        return { ok: false, error: V.t("valEmailExists") };
      }
      return result;
    });
    var passBind = V.bind(passInput, document.getElementById("regPasswordError"), function () {
      return V.password(passInput.value, {
        name: nameInput.value,
        email: emailInput.value,
        phone: phoneInput ? phoneInput.value : "",
      });
    });
    var confirmBind = V.bind(confirmInput, document.getElementById("regConfirmError"), function () {
      return V.confirm(passInput.value, confirmInput.value);
    });
    var addressBind = V.bind(addressInput, document.getElementById("regAddressError"), function () {
      return V.address(addressInput.value);
    });
    var unitBind = V.bind(unitInput, document.getElementById("regUnitError"), function () {
      return V.unit(unitInput.value);
    });
    var neighborhoodBind = V.bind(
      neighborhoodInput,
      document.getElementById("regNeighborhoodError"),
      function () {
        return V.neighborhood(neighborhoodInput.value);
      }
    );
    var phoneBind = V.bind(phoneInput, document.getElementById("regPhoneError"), function () {
      return V.phone(phoneInput.value);
    });
    var accessBind = V.bind(accessInput, document.getElementById("regAccessError"), function () {
      return V.accessNotes(accessInput.value);
    });
    var complexNameBind = V.bind(
      complexNameInput,
      document.getElementById("regComplexNameError"),
      function () {
        if (inComplex !== true) return { ok: true };
        var text = V.compactSpaces(complexNameInput.value);
        if (!text) return { ok: false, error: V.t("valComplexNameRequired") };
        if (text.length < 2) return { ok: false, error: V.t("valNameShort") };
        if (text.length > 80) return { ok: false, error: V.t("valNameLong") };
        return { ok: true };
      }
    );
    var complexTowerBind = V.bind(
      complexTowerInput,
      document.getElementById("regComplexTowerError"),
      function () {
        if (inComplex !== true) return { ok: true };
        return V.unit(complexTowerInput.value);
      }
    );
    var complexAptBind = V.bind(
      complexAptInput,
      document.getElementById("regComplexAptError"),
      function () {
        if (inComplex !== true) return { ok: true };
        var text = V.compactSpaces(complexAptInput.value);
        if (!text) return { ok: false, error: V.t("valComplexAptRequired") };
        return V.unit(text);
      }
    );
    bindings.push(
      nameBind,
      emailBind,
      passBind,
      confirmBind,
      addressBind,
      unitBind,
      neighborhoodBind,
      phoneBind,
      accessBind,
      complexNameBind,
      complexTowerBind,
      complexAptBind
    );

    function setChip(btn, on) {
      if (!btn) return;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }

    function paintComplexChoice() {
      setChip(document.getElementById("regComplexYes"), inComplex === true);
      setChip(document.getElementById("regComplexNo"), inComplex === false);
      if (complexFields) complexFields.hidden = inComplex !== true;
      if (complexError) complexError.textContent = "";
      if (inComplex !== true) {
        needsAuth = null;
        setChip(document.getElementById("regNeedsAuthYes"), false);
        setChip(document.getElementById("regNeedsAuthNo"), false);
        if (needsAuthError) needsAuthError.textContent = "";
        complexNameBind.reset();
        complexTowerBind.reset();
        complexAptBind.reset();
      }
    }

    function paintNeedsAuth() {
      setChip(document.getElementById("regNeedsAuthYes"), needsAuth === true);
      setChip(document.getElementById("regNeedsAuthNo"), needsAuth === false);
      if (needsAuthError) needsAuthError.textContent = "";
    }

    document.getElementById("regComplexYes").addEventListener("click", function () {
      inComplex = true;
      paintComplexChoice();
    });
    document.getElementById("regComplexNo").addEventListener("click", function () {
      inComplex = false;
      paintComplexChoice();
    });
    document.getElementById("regNeedsAuthYes").addEventListener("click", function () {
      needsAuth = true;
      paintNeedsAuth();
    });
    document.getElementById("regNeedsAuthNo").addEventListener("click", function () {
      needsAuth = false;
      paintNeedsAuth();
    });
    paintComplexChoice();

    nameInput.addEventListener("input", function () {
      if (passInput.value) passBind.refresh();
    });
    emailInput.addEventListener("input", function () {
      if (passInput.value) passBind.refresh();
    });
    phoneInput.addEventListener("input", function () {
      if (passInput.value) passBind.refresh();
    });
    passInput.addEventListener("input", function () {
      if (confirmInput.value) confirmBind.refresh();
    });

    registerForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var nameOk = nameBind.validate();
      var emailOk = emailBind.validate();
      var passOk = passBind.validate();
      var confirmOk = confirmBind.validate();
      var addressOk = addressBind.validate();
      var unitOk = unitBind.validate();
      var neighborhoodOk = neighborhoodBind.validate();
      var phoneOk = phoneBind.validate();
      var accessOk = accessBind.validate();
      var complexOk = true;
      var needsAuthOk = true;
      var complexNameOk = true;
      var complexTowerOk = true;
      var complexAptOk = true;

      if (inComplex === null) {
        complexOk = false;
        if (complexError) complexError.textContent = V.t("valComplexRequired");
      } else if (inComplex === true) {
        complexNameOk = complexNameBind.validate();
        complexTowerOk = complexTowerBind.validate();
        complexAptOk = complexAptBind.validate();
        if (needsAuth === null) {
          needsAuthOk = false;
          if (needsAuthError) needsAuthError.textContent = V.t("valNeedsAuthRequired");
        }
      }

      var msg = document.getElementById("registerMsg");
      if (
        !nameOk ||
        !emailOk ||
        !passOk ||
        !confirmOk ||
        !addressOk ||
        !unitOk ||
        !neighborhoodOk ||
        !phoneOk ||
        !accessOk ||
        !complexOk ||
        !needsAuthOk ||
        !complexNameOk ||
        !complexTowerOk ||
        !complexAptOk
      ) {
        showFormMsg(msg, V.t("valFormFix"));
        firstInvalid(registerForm);
        return;
      }

      window.HandsAuth.register({
        name: nameInput.value,
        email: emailInput.value,
        password: passInput.value,
        confirm: confirmInput.value,
        property: {
          address: addressInput.value,
          unit: unitInput.value,
          neighborhood: neighborhoodInput.value,
          phone: phoneInput.value,
          inComplex: inComplex,
          complexName: complexNameInput.value,
          complexTower: complexTowerInput.value,
          complexApt: complexAptInput.value,
          needsAuth: needsAuth === true,
          accessNotes: accessInput.value,
        },
      }).then(function (result) {
        if (!result.ok) {
          showFormMsg(msg, result.message || V.t("valFormFix"));
          return;
        }
        redirectAfterAuth(result.user);
      });
    });
  }

  var goRegister = document.querySelector('a[href="register.html"]');
  if (goRegister) goRegister.setAttribute("href", withNext("register.html"));
  var goLogin = document.querySelector('a[href="login.html"]');
  if (goLogin) goLogin.setAttribute("href", withNext("login.html"));

  applyI18n();
})();
