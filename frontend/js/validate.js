/**
 * HandsValidate — shared field validators and live form bindings.
 *
 * Used by registration, login, admin account creation, and the service builder.
 * Validators return { ok, error } where error is an i18n key (or empty string).
 * bind() attaches blur/input listeners and keeps aria-invalid in sync.
 */
window.HandsValidate = (function () {
  /* --- Patterns & denylist --- */
  var NAME_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[ '\-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/;
  var ROLE_NAME_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[ \-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/;
  var EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
  var SLUG_RE = /^[a-z][a-z0-9\-]{2,39}$/;
  var PASSWORD_SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;
  var COMMON_PASSWORDS = [
    "password",
    "password1",
    "password12",
    "password123",
    "passw0rd",
    "12345678",
    "123456789",
    "1234567890",
    "qwerty",
    "qwerty123",
    "qwertyuiop",
    "abc123",
    "abcd1234",
    "admin",
    "admin123",
    "administrator",
    "letmein",
    "welcome",
    "welcome1",
    "iloveyou",
    "monkey",
    "dragon",
    "master",
    "login",
    "princess",
    "football",
    "baseball",
    "soccer",
    "shadow",
    "sunshine",
    "trustno1",
    "whatever",
    "hands123",
    "hands2026",
    "colombia",
    "colombia1",
    "bogota123",
    "changeme",
    "secret",
    "default",
    "guest",
    "root",
    "toor",
    "pass",
    "pass1234",
    "1q2w3e4r",
    "zaq12wsx",
    "asdfghjk",
    "zxcvbnm",
  ];

  function t(key) {
    var lang = localStorage.getItem("hands-lang") || "es";
    var dict =
      (window.HandsI18n && window.HandsI18n[lang]) ||
      (window.HandsI18n && window.HandsI18n.es) ||
      {};
    return dict[key] || key;
  }

  function compactSpaces(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function ok() {
    return { ok: true, error: "" };
  }

  function fail(key) {
    return { ok: false, error: t(key) };
  }

  /* --- Field validators --- */
  function personName(value) {
    var name = compactSpaces(value);
    if (!name) return fail("valNameRequired");
    if (/\d/.test(name)) return fail("valNameNumbers");
    if (name.length < 2) return fail("valNameShort");
    if (name.length > 60) return fail("valNameLong");
    if (!NAME_RE.test(name)) return fail("valNameChars");
    return ok();
  }

  function roleName(value) {
    var name = compactSpaces(value);
    if (!name) return fail("valRoleNameRequired");
    if (/\d/.test(name)) return fail("valNameNumbers");
    if (name.length < 3) return fail("valRoleNameShort");
    if (name.length > 40) return fail("valRoleNameLong");
    if (!ROLE_NAME_RE.test(name)) return fail("valRoleNameChars");
    return ok();
  }

  function email(value) {
    var mail = String(value || "").trim().toLowerCase();
    if (!mail) return fail("valEmailRequired");
    if (mail.length > 80) return fail("valEmailLong");
    if (/\s/.test(mail)) return fail("valEmailFormat");
    if (mail.indexOf("..") !== -1) return fail("valEmailFormat");
    if (!EMAIL_RE.test(mail)) return fail("valEmailFormat");
    return ok();
  }

  /**
   * Password policy for account creation.
   * Default minimum is 8 characters; pass context.minLength (e.g. 12) for stricter flows.
   * Also rejects common passwords and values derived from name/email/phone.
   * Optional context: { name, email, phone, minLength }.
   */
  function password(value, context) {
    var pass = String(value || "");
    var ctx = context || {};
    var minLength = Number(ctx.minLength) > 0 ? Number(ctx.minLength) : 8;

    if (!pass) return fail("valPasswordRequired");
    if (pass !== pass.trim()) return fail("valPasswordTrim");
    if (/\s/.test(pass)) return fail("valPasswordSpaces");
    if (pass.length < minLength) {
      return fail(minLength >= 12 ? "valPasswordShortStrict" : "valPasswordShort");
    }
    if (pass.length > 64) return fail("valPasswordLong");
    if (!/[a-z]/.test(pass)) return fail("valPasswordLower");
    if (!/[A-Z]/.test(pass)) return fail("valPasswordUpper");
    if (!/\d/.test(pass)) return fail("valPasswordNumber");
    if (!PASSWORD_SPECIAL_RE.test(pass)) return fail("valPasswordSpecial");
    if (isCommonPassword(pass)) return fail("valPasswordCommon");
    if (usesPersonalData(pass, ctx)) return fail("valPasswordPersonal");
    return ok();
  }

  function normalizeSecret(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function isCommonPassword(value) {
    var lower = String(value || "").toLowerCase();
    var compact = normalizeSecret(value);
    if (COMMON_PASSWORDS.indexOf(lower) !== -1) return true;
    if (COMMON_PASSWORDS.indexOf(compact) !== -1) return true;
    // Common base + trailing year/digits (password2024, admin1234).
    return COMMON_PASSWORDS.some(function (item) {
      if (item.length < 5) return false;
      return new RegExp("^" + item + "\\d{0,4}$").test(compact);
    });
  }

  /** Tokens from name/email/phone used to reject passwords that embed personal data. */
  function personalTokens(context) {
    var tokens = [];
    var name = compactSpaces(context.name || "");
    var email = String(context.email || "").trim().toLowerCase();
    var phone = String(context.phone || "").replace(/\D/g, "");

    if (name) {
      name.split(/[\s'\-]+/).forEach(function (part) {
        var token = normalizeSecret(part);
        if (token.length >= 3) tokens.push(token);
      });
      var full = normalizeSecret(name);
      if (full.length >= 3) tokens.push(full);
    }

    if (email) {
      var local = email.split("@")[0] || "";
      var localNorm = normalizeSecret(local);
      if (localNorm.length >= 3) tokens.push(localNorm);
      local.split(/[._+\-]/).forEach(function (part) {
        var token = normalizeSecret(part);
        if (token.length >= 3) tokens.push(token);
      });
    }

    if (phone.length >= 7) {
      tokens.push(phone);
      tokens.push(phone.slice(-7));
      tokens.push(phone.slice(-10));
    }

    return tokens;
  }

  function usesPersonalData(passwordValue, context) {
    var secret = normalizeSecret(passwordValue);
    if (secret.length < 3) return false;
    return personalTokens(context).some(function (token) {
      return token && secret.indexOf(token) !== -1;
    });
  }

  /** Non-empty check only — complexity is enforced when the account is created. */
  function loginPassword(value) {
    var pass = String(value || "");
    if (!pass) return fail("valPasswordRequired");
    if (pass.length > 64) return fail("valPasswordLong");
    return ok();
  }

  function confirm(passwordValue, confirmValue) {
    var pass = String(passwordValue || "");
    var again = String(confirmValue || "");
    if (!again) return fail("valConfirmRequired");
    if (pass !== again) return fail("valConfirmMismatch");
    return ok();
  }

  function slug(value) {
    var id = String(value || "").trim().toLowerCase();
    if (!id) return fail("valSlugRequired");
    if (id.length < 3) return fail("valSlugShort");
    if (id.length > 40) return fail("valSlugLong");
    if (!SLUG_RE.test(id)) return fail("valSlugChars");
    return ok();
  }

  function description(value) {
    var text = compactSpaces(value);
    if (!text) return ok();
    if (text.length < 10) return fail("valDescShort");
    if (text.length > 160) return fail("valDescLong");
    return ok();
  }

  function address(value) {
    var text = compactSpaces(value);
    if (!text) return fail("valAddressRequired");
    if (text.length < 8) return fail("valAddressShort");
    if (text.length > 120) return fail("valAddressLong");
    if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(text)) return fail("valAddressChars");
    return ok();
  }

  function unit(value) {
    var text = compactSpaces(value);
    if (!text) return ok();
    if (text.length > 40) return fail("valUnitLong");
    return ok();
  }

  function neighborhood(value) {
    var text = compactSpaces(value);
    if (!text) return ok();
    if (text.length < 2) return fail("valNeighborhoodShort");
    if (text.length > 40) return fail("valNeighborhoodLong");
    return ok();
  }

  function phone(value) {
    var raw = String(value || "").trim();
    if (!raw) return fail("valPhoneRequired");
    var digits = raw.replace(/\D/g, "");
    // Accept optional Colombia country code (+57) then require a 10-digit mobile.
    if (digits.indexOf("57") === 0 && digits.length === 12) digits = digits.slice(2);
    if (digits.length !== 10) return fail("valPhoneFormat");
    if (!/^[36]/.test(digits)) return fail("valPhoneFormat");
    return ok();
  }

  function accessNotes(value) {
    var text = compactSpaces(value);
    if (!text) return ok();
    if (text.length > 160) return fail("valDescLong");
    return ok();
  }

  function access(value) {
    if (value === "host" || value === "admin" || value === "provider") return ok();
    return fail("valAccessRequired");
  }

  /* --- Live bindings --- */
  function setFieldState(input, errorEl, result) {
    if (!input) return result;
    input.classList.toggle("is-invalid", !result.ok);
    input.classList.toggle("is-valid", result.ok && String(input.value || "").trim() !== "");
    input.setAttribute("aria-invalid", result.ok ? "false" : "true");
    if (errorEl) {
      errorEl.textContent = result.ok ? "" : result.error;
    }
    return result;
  }

  function bind(input, errorEl, check) {
    var touched = false;

    function run() {
      return setFieldState(input, errorEl, check());
    }

    function onInput() {
      if (touched || String(input.value || "").length > 0) run();
    }

    input.addEventListener("blur", function () {
      touched = true;
      run();
    });
    input.addEventListener("input", onInput);
    input.addEventListener("change", onInput);

    return {
      validate: function () {
        touched = true;
        return run().ok;
      },
      refresh: function () {
        if (touched || String(input.value || "").trim()) run();
      },
      reset: function () {
        touched = false;
        input.classList.remove("is-invalid", "is-valid");
        input.setAttribute("aria-invalid", "false");
        if (errorEl) errorEl.textContent = "";
      },
    };
  }

  return {
    t: t,
    compactSpaces: compactSpaces,
    personName: personName,
    roleName: roleName,
    email: email,
    password: password,
    loginPassword: loginPassword,
    confirm: confirm,
    slug: slug,
    description: description,
    address: address,
    unit: unit,
    neighborhood: neighborhood,
    phone: phone,
    accessNotes: accessNotes,
    access: access,
    setFieldState: setFieldState,
    bind: bind,
  };
})();
