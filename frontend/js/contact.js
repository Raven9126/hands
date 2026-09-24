/**
 * Contact form — demo submission stored in localStorage (no server).
 */
(function () {
  var form = document.getElementById("contactForm");
  if (!form || !window.HandsValidate) return;

  var V = window.HandsValidate;
  var KEY = "hands-contact-messages";

  function t(key, fallback) {
    return (window.HandsI18n && window.HandsI18n.dict()[key]) || fallback || key;
  }

  function readMessages() {
    try {
      var raw = localStorage.getItem(KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveMessage(entry) {
    var list = readMessages();
    list.unshift(entry);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  }

  var nameInput = document.getElementById("contactName");
  var emailInput = document.getElementById("contactEmail");
  var phoneInput = document.getElementById("contactPhone");
  var reasonInput = document.getElementById("contactReason");
  var messageInput = document.getElementById("contactMessage");

  var nameBind = V.bind(nameInput, null, function () {
    return V.personName(nameInput.value);
  });
  var emailBind = V.bind(emailInput, null, function () {
    return V.email(emailInput.value);
  });
  var phoneBind = V.bind(phoneInput, null, function () {
    var raw = String(phoneInput.value || "").trim();
    if (!raw) return { ok: true };
    return V.phone(raw);
  });
  var messageBind = V.bind(messageInput, null, function () {
    var text = V.compactSpaces(messageInput.value);
    if (!text) return { ok: false, error: t("contactMessageRequired", "Escribe tu mensaje.") };
    if (text.length < 10) return { ok: false, error: t("contactMessageShort", "Usa al menos 10 caracteres.") };
    if (text.length > 1000) return { ok: false, error: t("valDescLong", "Máximo 160 caracteres.") };
    return { ok: true };
  });

  // Prefill from session when available.
  if (window.HandsAuth && window.HandsAuth.getSession) {
    window.HandsAuth.ready().then(function () {
      var session = window.HandsAuth.getSession();
      if (!session) return;
      if (!nameInput.value) nameInput.value = session.name || "";
      if (!emailInput.value) emailInput.value = session.email || "";
      var phone = session.property && session.property.phone;
      if (phone && !phoneInput.value) phoneInput.value = phone;
    });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var nameOk = nameBind.validate();
    var emailOk = emailBind.validate();
    var phoneOk = phoneBind.validate();
    var messageOk = messageBind.validate();
    var reasonOk = !!reasonInput.value;
    reasonInput.classList.toggle("is-invalid", !reasonOk);
    reasonInput.classList.toggle("is-valid", reasonOk);

    var note = form.querySelector(".contact-note");
    if (!nameOk || !emailOk || !phoneOk || !messageOk || !reasonOk) {
      if (note) {
        note.textContent = t("valFormFix", "Revisa los campos marcados.");
        note.classList.add("is-error");
      }
      var invalid = form.querySelector(".is-invalid");
      if (invalid) invalid.focus();
      return;
    }

    saveMessage({
      id: "msg-" + Date.now().toString(36),
      createdAt: new Date().toISOString(),
      name: V.compactSpaces(nameInput.value),
      email: String(emailInput.value || "").trim().toLowerCase(),
      phone: String(phoneInput.value || "").trim(),
      reason: reasonInput.value,
      message: V.compactSpaces(messageInput.value),
    });

    form.reset();
    [nameInput, emailInput, phoneInput, reasonInput, messageInput].forEach(function (el) {
      el.classList.remove("is-invalid", "is-valid");
    });
    if (note) {
      note.classList.remove("is-error");
      note.textContent = t(
        "contactSubmitOk",
        "Mensaje guardado en este dispositivo (demo). Un equipo real lo recibiría por correo."
      );
    }
  });
})();
