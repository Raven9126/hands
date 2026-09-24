/**
 * Public marketing site and multi-step service-builder wizard.
 *
 * Responsibilities: live quote (base + extras + kit + commission), coverage
 * checks via HandsCities, sessionStorage draft, hash-based step navigation,
 * auth CTA rendering, and checkout handoff into HandsBookings.
 */
(function () {
  /* --- Pricing --- */
  var COMMISSION = 0.12;
  var KIT = 25000;
  var EXTRA_PRICES = { linen: 18000, restock: 12000 };
  var BASE = { xs: 90000, sm: 120000, md: 155000, lg: 195000 };
  var INTENSITY_MULT = { light: 0.85, standard: 1, intense: 1.3 };
  var DRAFT_KEY = "hands-draft-v3";
  var TOTAL_STEPS = 6;

  var CITIES = {
    bogota: "Bogotá",
    cajica: "Cajicá",
    chia: "Chía",
    medellin: "Medellín",
    tunja: "Tunja",
    zipaquira: "Zipaquirá",
  };

  function cityName(id) {
    if (window.HandsCities && window.HandsCities.nameById) {
      var fromStore = window.HandsCities.nameById(id);
      if (fromStore && fromStore !== id) return fromStore;
    }
    if (id === "otra") return dict().cityOther;
    return CITIES[id] || id || "—";
  }

  function fillCitySelect() {
    var select = document.getElementById("citySelect");
    if (!select) return;
    var current = state.city || select.value;
    var placeholder = dict().cityPlaceholder || "Selecciona una ciudad";
    var html = '<option value="">' + placeholder + "</option>";
    var cities = window.HandsCities
      ? window.HandsCities.list(false)
      : Object.keys(CITIES).map(function (id) {
          return { id: id, name: CITIES[id] };
        });
    cities.forEach(function (city) {
      html +=
        '<option value="' +
        city.id +
        '"' +
        (city.id === current ? " selected" : "") +
        ">" +
        city.name +
        "</option>";
    });
    html +=
      '<option value="otra"' +
      (current === "otra" ? " selected" : "") +
      ">" +
      (dict().cityOther || "Otra ciudad") +
      "</option>";
    select.innerHTML = html;
    if (current) select.value = current;
  }

  var OTHER_PRICES = { jardinero: 70000, plomero: 90000 };
  var OTHER_I18N = { jardinero: "otherGardener", plomero: "otherPlumber" };

  /* --- Wizard state --- */
  var wizard = document.getElementById("serviceWizard");
  var currentStep = 1;
  var proposalAccepted = false;

  var state = {
    lang: localStorage.getItem("hands-lang") || "es",
    size: "sm",
    intensity: "standard",
    supplies: "yes",
    timing: "scheduled",
    city: "",
    address: "",
    unit: "",
    neighborhood: "",
    phone: "",
    access: "",
    date: "",
    time: "",
    extras: [],
    other: [],
  };

  function dict() {
    return window.HandsI18n[state.lang] || window.HandsI18n.es;
  }

  function formatCop(n) {
    return Math.round(n).toLocaleString("es-CO");
  }

  /** Active catalog cities only; "otra" never counts as covered. */
  function hasCoverage() {
    if (!state.city || state.city === "otra") return false;
    if (window.HandsCities) {
      return window.HandsCities.list(false).some(function (c) {
        return c.id === state.city;
      });
    }
    return !!CITIES[state.city];
  }

  /* --- Draft (sessionStorage) --- */
  function loadDraft() {
    try {
      var raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      var draft = JSON.parse(raw);
      if (!draft || typeof draft !== "object") return;
      [
        "city",
        "address",
        "unit",
        "neighborhood",
        "phone",
        "access",
        "size",
        "intensity",
        "date",
        "time",
        "supplies",
        "timing",
      ].forEach(function (key) {
        if (typeof draft[key] === "string") state[key] = draft[key];
      });
      if (state.supplies === "none") state.supplies = "yes";
      if (Array.isArray(draft.other)) state.other = draft.other.slice();
      if (Array.isArray(draft.extras)) state.extras = draft.extras.slice();
      if (draft.proposalAccepted) proposalAccepted = true;
      if (draft.step) currentStep = Number(draft.step) || 1;
    } catch (e) {}
  }

  /** Prefill place fields from the host account property when the draft is empty. */
  function applyHostPropertyDefaults() {
    if (!window.HandsAuth || !window.HandsAuth.propertyToPlace) return;
    if (state.address || state.phone) return;
    var session = window.HandsAuth.getSession();
    if (!session || session.access !== "host" || !session.property) return;
    var place = window.HandsAuth.propertyToPlace(session.property);
    if (!place) return;
    state.address = place.address || state.address;
    state.unit = place.unit || state.unit;
    state.neighborhood = place.neighborhood || state.neighborhood;
    state.phone = place.phone || state.phone;
    state.access = place.access || state.access;
  }

  function saveDraft() {
    if (!wizard) return;
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          city: state.city,
          address: state.address,
          unit: state.unit,
          neighborhood: state.neighborhood,
          phone: state.phone,
          access: state.access,
          size: state.size,
          intensity: state.intensity,
          date: state.date,
          time: state.time,
          supplies: state.supplies,
          timing: state.timing,
          extras: extrasSelected(),
          other: state.other,
          proposalAccepted: proposalAccepted,
          step: currentStep,
        })
      );
    } catch (e) {}
  }

  function clearDraft() {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
  }

  function restoreExtras() {
    document.querySelectorAll('input[name="extra"]').forEach(function (input) {
      input.checked = state.extras.indexOf(input.value) !== -1;
    });
  }

  function applyI18n() {
    window.HandsI18n.apply();
    renderAuthActions();
    if (wizard) document.title = dict().pageTitleBuild;
    fillCitySelect();
    var select = document.getElementById("citySelect");
    if (select && state.city) select.value = state.city;
    var otherSelect = document.getElementById("otherSelect");
    if (otherSelect) otherSelect.value = "";
    renderOtherChips();
    fillTimeSlots();
    if (document.getElementById("serviceDate") && state.date) {
      document.getElementById("serviceDate").value = state.date;
    }
    if (document.getElementById("serviceTime") && state.time) {
      document.getElementById("serviceTime").value = state.time;
    }
    fillPlaceFields();
    restoreExtras();
    setSupplies(state.supplies, true);
    setTiming(state.timing, true);
    setIntensity(state.intensity, true);
    paintCoverage();
    paintWizard();
    calcQuote();
  }

  function otherLabel(id) {
    var key = OTHER_I18N[id];
    if (key && dict()[key]) return dict()[key];
    var opt = document.querySelector('#otherSelect option[value="' + id + '"]');
    return opt ? opt.textContent : id;
  }

  function otherTotal() {
    return state.other.reduce(function (sum, id) {
      return sum + (OTHER_PRICES[id] || 80000);
    }, 0);
  }

  function refreshOtherOptions() {
    var select = document.getElementById("otherSelect");
    if (!select) return;
    Array.prototype.forEach.call(select.options, function (opt) {
      if (!opt.value) return;
      opt.disabled = state.other.indexOf(opt.value) !== -1;
    });
  }

  function renderOtherChips() {
    var box = document.getElementById("otherChips");
    if (!box) return;
    if (!state.other.length) {
      box.innerHTML = "";
      refreshOtherOptions();
      return;
    }
    box.innerHTML = state.other
      .map(function (id) {
        return (
          '<button type="button" class="other-chip" data-remove-other="' +
          id +
          '" aria-label="' +
          dict().otherRemove +
          " " +
          otherLabel(id) +
          '">' +
          otherLabel(id) +
          ' <span aria-hidden="true">×</span></button>'
        );
      })
      .join("");
    refreshOtherOptions();
  }

  function addOther(id) {
    if (!id || state.other.indexOf(id) !== -1) return;
    state.other.push(id);
    renderOtherChips();
    calcQuote();
    saveDraft();
  }

  function removeOther(id) {
    state.other = state.other.filter(function (item) {
      return item !== id;
    });
    renderOtherChips();
    calcQuote();
    saveDraft();
  }

  function loadAdminTrades() {
    var select = document.getElementById("otherSelect");
    if (!select) return;
    try {
      var roles = JSON.parse(localStorage.getItem("hands-service-roles") || "[]");
      roles.forEach(function (role) {
        if (!role || !role.id || role.id === "cleaner") return;
        if (select.querySelector('option[value="' + role.id + '"]')) return;
        var opt = document.createElement("option");
        opt.value = role.id;
        opt.textContent = role.name;
        select.appendChild(opt);
        if (!OTHER_PRICES[role.id]) OTHER_PRICES[role.id] = 80000;
      });
    } catch (e) {}
  }

  /* --- Auth header + mobile menu actions --- */
  function renderAuthActions() {
    var box = document.getElementById("authActions");
    var mobile = document.getElementById("navMobileActions");
    if ((!box && !mobile) || !window.HandsAuth) return;
    var d = dict();
    var session = window.HandsAuth.getSession();
    var nextLogin = wizard
      ? "login.html?next=" + encodeURIComponent("build.html#step-" + currentStep)
      : "login.html";
    var nextRegister = wizard
      ? "register.html?next=" + encodeURIComponent("build.html#step-" + currentStep)
      : "register.html";

    function wireLogout(root) {
      if (!root) return;
      var logoutBtn = root.querySelector("[data-logout]");
      if (!logoutBtn) return;
      logoutBtn.addEventListener("click", function () {
        window.HandsAuth.logout();
        renderAuthActions();
        window.location.href = "index.html";
      });
    }

    if (!session) {
      var guestHeader =
        '<a class="btn btn-text" href="' +
        nextLogin +
        '" data-i18n="navLogin">' +
        d.navLogin +
        "</a>" +
        '<a class="btn btn-ghost" href="' +
        nextRegister +
        '" data-i18n="navRegister">' +
        d.navRegister +
        "</a>";
      var guestMobile =
        '<a href="' +
        nextLogin +
        '" data-i18n="navLogin">' +
        d.navLogin +
        "</a>" +
        '<a href="' +
        nextRegister +
        '" data-i18n="navRegister">' +
        d.navRegister +
        "</a>" +
        '<a class="nav-mobile-cta" href="build.html" data-i18n="navCta">' +
        d.navCta +
        "</a>";
      if (box) box.innerHTML = guestHeader;
      if (mobile) mobile.innerHTML = guestMobile;
      return;
    }

    var roleLink = "";
    var roleMobile = "";
    if (session.access === "provider") {
      roleLink =
        '<a class="btn btn-text" href="provider.html" data-i18n="navProviderJobs">' +
        (d.navProviderJobs || "Mis servicios") +
        "</a>";
      roleMobile =
        '<a href="provider.html" data-i18n="navProviderJobs">' +
        (d.navProviderJobs || "Mis servicios") +
        "</a>";
    } else if (session.access === "admin") {
      roleLink =
        '<a class="btn btn-text" href="admin.html" data-i18n="adminPanelEyebrow">' +
        (d.adminPanelEyebrow || "Admin") +
        "</a>";
      roleMobile =
        '<a href="admin.html" data-i18n="adminPanelEyebrow">' +
        (d.adminPanelEyebrow || "Admin") +
        "</a>";
    } else {
      roleMobile =
        '<a href="account.html" data-i18n="accountTitle">' +
        (d.accountTitle || d.navAccount) +
        "</a>" +
        '<a href="bookings.html" data-i18n="navBookings">' +
        (d.navBookings || "Mis reservas") +
        "</a>";
    }

    if (box) {
      box.innerHTML =
        '<span class="auth-hello">' +
        d.navAccount +
        " " +
        session.name.split(" ")[0] +
        "</span>" +
        roleLink +
        '<button type="button" class="btn btn-ghost" data-logout data-i18n="navLogout">' +
        d.navLogout +
        "</button>";
      wireLogout(box);
    }

    if (mobile) {
      mobile.innerHTML =
        '<span class="auth-hello">' +
        d.navAccount +
        " " +
        session.name.split(" ")[0] +
        "</span>" +
        roleMobile +
        '<a class="nav-mobile-cta" href="build.html" data-i18n="navCta">' +
        d.navCta +
        "</a>" +
        '<button type="button" data-logout data-i18n="navLogout">' +
        d.navLogout +
        "</button>";
      wireLogout(mobile);
    }
  }

  /* --- Quote --- */
  function extrasSelected() {
    var extras = [];
    var boxes = document.querySelectorAll('input[name="extra"]');
    if (boxes.length) {
      boxes.forEach(function (el) {
        if (el.checked) extras.push(el.value);
      });
      state.extras = extras;
      return extras;
    }
    return state.extras.slice();
  }

  function quoteTotals() {
    var mult = INTENSITY_MULT[state.intensity] || INTENSITY_MULT.standard;
    var base = Math.round((BASE[state.size] || BASE.sm) * mult);
    var kit = state.supplies === "kit" ? KIT : 0;
    var extras = extrasSelected().reduce(function (sum, id) {
      return sum + (EXTRA_PRICES[id] || 0);
    }, 0);
    var other = otherTotal();
    var subtotal = base + kit + extras + other;
    var fee = subtotal * COMMISSION;
    return {
      base: base,
      kit: kit,
      extras: extras,
      other: other,
      fee: fee,
      total: subtotal + fee,
    };
  }

  function fillTimeSlots() {
    var grid = document.getElementById("timeSlots");
    var hidden = document.getElementById("serviceTime");
    var B = window.HandsBookings;
    if (!grid || !B) return;
    var date = state.date;
    var keep = state.time;
    var available = date ? B.availableSlots(date) : B.SLOTS.slice();
    if (keep && available.indexOf(keep) === -1) {
      keep = "";
      state.time = "";
    }
    if (!available.length) {
      grid.innerHTML = '<p class="time-empty">' + dict().whenTimeNone + "</p>";
      if (hidden) hidden.value = "";
      state.time = "";
      return;
    }
    grid.innerHTML = available
      .map(function (slot) {
        var on = slot === keep ? " is-on" : "";
        var pressed = slot === keep ? "true" : "false";
        return (
          '<button type="button" class="time-slot' +
          on +
          '" data-time="' +
          slot +
          '" role="radio" aria-checked="' +
          pressed +
          '">' +
          slot +
          "</button>"
        );
      })
      .join("");
    if (hidden) hidden.value = keep || "";
  }

  function pickTime(slot) {
    var hidden = document.getElementById("serviceTime");
    state.time = slot || "";
    if (hidden) hidden.value = state.time;
    fillTimeSlots();
    setWhen();
    validateWhen(true);
  }

  function markWhen(input, errorEl, result) {
    if (!input) return result.ok;
    input.classList.toggle("is-invalid", !result.ok);
    input.classList.toggle("is-valid", result.ok && !!input.value);
    input.setAttribute("aria-invalid", result.ok ? "false" : "true");
    if (errorEl) errorEl.textContent = result.ok ? "" : result.error;
    return result.ok;
  }

  function validateWhen(force) {
    if (state.timing === "urgent") return assignUrgentSlot();
    var B = window.HandsBookings;
    var dateInput = document.getElementById("serviceDate");
    var timeField = document.querySelector(".time-field");
    var hidden = document.getElementById("serviceTime");
    var dateError = document.getElementById("dateError");
    var timeError = document.getElementById("timeError");
    if (!B || !dateInput) return true;
    var dateRes = B.validateDate(state.date);
    var timeRes = B.validateTime(state.date, state.time);
    var showDate = force || !!state.date || dateInput.classList.contains("is-invalid");
    var showTime = force || !!state.time || (timeField && timeField.classList.contains("is-invalid"));
    if (showDate) markWhen(dateInput, dateError, dateRes);
    if (showTime) {
      if (timeField) {
        timeField.classList.toggle("is-invalid", !timeRes.ok);
        timeField.classList.toggle("is-valid", timeRes.ok && !!state.time);
      }
      if (hidden) {
        hidden.classList.toggle("is-invalid", !timeRes.ok);
        hidden.setAttribute("aria-invalid", timeRes.ok ? "false" : "true");
      }
      if (timeError) timeError.textContent = timeRes.ok ? "" : timeRes.error;
    }
    return dateRes.ok && timeRes.ok;
  }

  function assignUrgentSlot() {
    var B = window.HandsBookings;
    if (!B) return false;
    var today = B.ymd(new Date());
    var tomorrow = B.ymd(B.addDays(new Date(), 1));
    var slots = B.availableSlots(today);
    if (slots.length) {
      state.date = today;
      state.time = slots[0];
    } else {
      state.date = tomorrow;
      var next = B.availableSlots(tomorrow);
      state.time = next[0] || B.SLOTS[0];
    }
    var dateInput = document.getElementById("serviceDate");
    var hidden = document.getElementById("serviceTime");
    if (dateInput) dateInput.value = state.date;
    if (hidden) hidden.value = state.time;
    fillTimeSlots();
    calcQuote();
    saveDraft();
    return !!(state.date && state.time);
  }

  function setWhen() {
    var dateInput = document.getElementById("serviceDate");
    var timeSelect = document.getElementById("serviceTime");
    if (state.timing === "scheduled") {
      state.date = dateInput ? dateInput.value : "";
      state.time = timeSelect ? timeSelect.value : "";
    }
    calcQuote();
    saveDraft();
  }

  function placeInput(id) {
    return document.getElementById(id);
  }

  function readPlace() {
    var V = window.HandsValidate;
    var compact = V
      ? V.compactSpaces
      : function (v) {
          return String(v || "").trim();
        };
    state.address = compact(
      placeInput("serviceAddress") ? placeInput("serviceAddress").value : state.address
    );
    state.unit = compact(placeInput("serviceUnit") ? placeInput("serviceUnit").value : state.unit);
    state.neighborhood = compact(
      placeInput("serviceNeighborhood")
        ? placeInput("serviceNeighborhood").value
        : state.neighborhood
    );
    state.phone = String(
      placeInput("servicePhone") ? placeInput("servicePhone").value : state.phone || ""
    ).trim();
    state.access = compact(
      placeInput("serviceAccess") ? placeInput("serviceAccess").value : state.access
    );
  }

  function fillPlaceFields() {
    if (placeInput("serviceAddress")) placeInput("serviceAddress").value = state.address;
    if (placeInput("serviceUnit")) placeInput("serviceUnit").value = state.unit;
    if (placeInput("serviceNeighborhood"))
      placeInput("serviceNeighborhood").value = state.neighborhood;
    if (placeInput("servicePhone")) placeInput("servicePhone").value = state.phone;
    if (placeInput("serviceAccess")) placeInput("serviceAccess").value = state.access;
  }

  function formatPlace() {
    if (window.HandsBookings && window.HandsBookings.formatPlace) {
      return window.HandsBookings.formatPlace(state);
    }
    return state.address || "—";
  }

  function placeComplete() {
    var V = window.HandsValidate;
    if (!state.city) return false;
    if (!V) return !!(state.address && state.phone);
    readPlace();
    return (
      V.address(state.address).ok &&
      V.unit(state.unit).ok &&
      V.neighborhood(state.neighborhood).ok &&
      V.phone(state.phone).ok &&
      V.accessNotes(state.access).ok
    );
  }

  function whenComplete() {
    if (state.timing === "urgent") return assignUrgentSlot();
    var B = window.HandsBookings;
    if (!B) return !!(state.date && state.time);
    return B.validateDate(state.date).ok && B.validateTime(state.date, state.time).ok;
  }

  function validatePlace(force) {
    var V = window.HandsValidate;
    if (!V || !placeInput("serviceAddress")) return true;
    readPlace();
    var checks = [
      ["serviceAddress", "addressError", V.address(state.address), force || !!state.address],
      ["serviceUnit", "unitError", V.unit(state.unit), force || !!state.unit],
      [
        "serviceNeighborhood",
        "neighborhoodError",
        V.neighborhood(state.neighborhood),
        force || !!state.neighborhood,
      ],
      ["servicePhone", "phoneError", V.phone(state.phone), force || !!state.phone],
      ["serviceAccess", "accessError", V.accessNotes(state.access), force || !!state.access],
    ];
    checks.forEach(function (row) {
      var input = placeInput(row[0]);
      var shouldShow = row[3] || (input && input.classList.contains("is-invalid"));
      if (!shouldShow) return;
      markWhen(input, document.getElementById(row[1]), row[2]);
    });
    return (
      checks[0][2].ok &&
      checks[1][2].ok &&
      checks[2][2].ok &&
      checks[3][2].ok &&
      checks[4][2].ok
    );
  }

  function setPlace() {
    readPlace();
    calcQuote();
    saveDraft();
  }

  function calcQuote() {
    var q = quoteTotals();
    var amount = document.getElementById("quoteAmount");
    var checkout = document.getElementById("checkoutAmount");
    if (amount) amount.textContent = formatCop(q.total);
    if (checkout) checkout.textContent = formatCop(q.total);
    if (!amount) return q;

    document.getElementById("quoteBase").textContent = formatCop(q.base);
    document.getElementById("quoteKit").textContent = formatCop(q.kit);
    document.getElementById("quoteExtras").textContent = formatCop(q.extras);
    var otherEl = document.getElementById("quoteOther");
    if (otherEl) otherEl.textContent = formatCop(q.other);
    document.getElementById("quoteFee").textContent = formatCop(q.fee);
    var cityEl = document.getElementById("quoteCity");
    if (cityEl) cityEl.textContent = cityName(state.city);
    var addressEl = document.getElementById("quoteAddress");
    if (addressEl) addressEl.textContent = formatPlace();
    var whenEl = document.getElementById("quoteWhen");
    if (whenEl) {
      whenEl.textContent = window.HandsBookings
        ? window.HandsBookings.formatWhen(state.date, state.time)
        : "—";
    }
    var timingEl = document.getElementById("quoteTiming");
    if (timingEl) {
      timingEl.textContent =
        state.timing === "urgent" ? dict().timingUrgent : dict().timingScheduled;
    }
    return q;
  }

  function setCity(value) {
    state.city = value;
    proposalAccepted = false;
    var select = document.getElementById("citySelect");
    var error = document.getElementById("cityError");
    if (select) {
      select.classList.toggle("is-invalid", false);
      select.classList.toggle("is-valid", !!value);
      select.setAttribute("aria-invalid", value ? "false" : "true");
    }
    if (error && value) error.textContent = "";
    paintCoverage();
    calcQuote();
    saveDraft();
  }

  function paintCoverage() {
    var yes = document.getElementById("coverageYes");
    var no = document.getElementById("coverageNo");
    var body = document.getElementById("coverageYesBody");
    if (!yes || !no) return;
    var covered = hasCoverage();
    yes.hidden = !covered;
    no.hidden = covered || !state.city;
    if (covered && body) {
      body.textContent = dict().coverageYesBody.replace("{city}", cityName(state.city));
    }
  }

  function popSize(card) {
    var iso = card.querySelector(".size-iso");
    card.classList.remove("is-popping");
    if (iso) iso.classList.remove("is-animating");
    void card.offsetWidth;
    card.classList.add("is-popping");
    if (iso) iso.classList.add("is-animating");
  }

  function setSize(size) {
    state.size = size;
    document.querySelectorAll(".size-card").forEach(function (card) {
      var on = card.getAttribute("data-size") === size;
      card.classList.toggle("is-selected", on);
      card.setAttribute("aria-pressed", on ? "true" : "false");
      if (!on) {
        card.classList.remove("is-popping");
        var iso = card.querySelector(".size-iso");
        if (iso) iso.classList.remove("is-animating");
      }
    });
    calcQuote();
    saveDraft();
  }

  function setIntensity(value, silent) {
    state.intensity = value || "standard";
    document.querySelectorAll(".intensity-card").forEach(function (card) {
      var on = card.getAttribute("data-intensity") === state.intensity;
      card.classList.toggle("is-selected", on);
      card.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (!silent) {
      calcQuote();
      saveDraft();
    }
  }

  function setSupplies(value, silent) {
    state.supplies = value || "yes";
    document.querySelectorAll(".supplies-card").forEach(function (card) {
      var on = card.getAttribute("data-supplies") === state.supplies;
      card.classList.toggle("is-selected", on);
      card.setAttribute("aria-pressed", on ? "true" : "false");
      if (!on) card.classList.remove("is-popping");
    });
    var hint = document.getElementById("kitHint");
    if (hint) hint.hidden = state.supplies !== "kit";
    if (!silent) {
      calcQuote();
      saveDraft();
    }
  }

  function popSupplies(card) {
    if (!card) return;
    card.classList.remove("is-popping");
    void card.offsetWidth;
    card.classList.add("is-popping");
  }

  function setTiming(value, silent) {
    state.timing = value || "scheduled";
    document.querySelectorAll(".timing-card").forEach(function (card) {
      var on = card.getAttribute("data-timing") === state.timing;
      card.classList.toggle("is-selected", on);
      card.setAttribute("aria-pressed", on ? "true" : "false");
      if (!on) card.classList.remove("is-popping");
    });
    var scheduled = document.getElementById("scheduledBlock");
    var urgentHint = document.getElementById("urgentHint");
    if (scheduled) scheduled.hidden = state.timing === "urgent";
    if (urgentHint) urgentHint.hidden = state.timing !== "urgent";
    if (state.timing === "urgent") assignUrgentSlot();
    if (!silent) {
      calcQuote();
      saveDraft();
    }
  }

  function popTiming(card) {
    if (!card) return;
    card.classList.remove("is-popping");
    void card.offsetWidth;
    card.classList.add("is-popping");
  }

  /* --- Wizard navigation --- */
  function hashFor(n) {
    return "#step-" + n;
  }

  function stepFromHash() {
    var match = String(location.hash || "").match(/step-(\d+)/);
    return match ? Number(match[1]) : 0;
  }

  function whenReady() {
    if (state.timing === "urgent") return !!(state.date && state.time);
    var B = window.HandsBookings;
    if (!B) return !!(state.date && state.time);
    return B.validateDate(state.date).ok && B.validateTime(state.date, state.time).ok;
  }

  /** Highest step the host may open without skipping incomplete prerequisites. */
  function maxReachable() {
    if (!state.size || !state.intensity) return 1;
    if (!placeComplete()) return 2;
    if (!hasCoverage() || !state.supplies) return 3;
    if (!whenReady()) return 4;
    if (!proposalAccepted) return 5;
    return TOTAL_STEPS;
  }

  function validateStep(step) {
    if (step === 1) return !!(state.size && state.intensity);
    if (step === 2) {
      if (!state.city) {
        var citySelect = document.getElementById("citySelect");
        var cityError = document.getElementById("cityError");
        if (citySelect) {
          citySelect.classList.add("is-invalid");
          citySelect.setAttribute("aria-invalid", "true");
          citySelect.focus();
        }
        if (cityError) cityError.textContent = dict().cityRequired;
        return false;
      }
      if (!validatePlace(true)) {
        var badPlace = document.querySelector(
          "#serviceAddress.is-invalid, #servicePhone.is-invalid, #serviceUnit.is-invalid, #serviceNeighborhood.is-invalid, #serviceAccess.is-invalid"
        );
        if (badPlace) badPlace.focus();
        return false;
      }
      return true;
    }
    if (step === 3) return hasCoverage() && !!state.supplies;
    if (step === 4) {
      if (!validateWhen(true)) {
        var bad = document.querySelector("#serviceDate.is-invalid, .time-field.is-invalid");
        if (bad) {
          if (bad.id === "serviceDate") bad.focus();
          else bad.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        return false;
      }
      return true;
    }
    if (step === 5) return proposalAccepted;
    return true;
  }

  function paintWizard() {
    if (!wizard) return;
    paintCoverage();
    document.querySelectorAll(".wizard-pane").forEach(function (pane) {
      var on = Number(pane.getAttribute("data-step")) === currentStep;
      pane.classList.toggle("is-on", on);
      pane.hidden = !on;
    });
    var progress = document.getElementById("wizardProgress");
    if (progress) {
      progress.textContent = dict()
        .wizardProgress.replace("{n}", String(currentStep))
        .replace("{total}", String(TOTAL_STEPS));
    }
    var bar = document.getElementById("wizardBar");
    if (bar) bar.style.width = (currentStep / TOTAL_STEPS) * 100 + "%";
    var back = document.getElementById("wizardBack");
    var next = document.getElementById("wizardNext");
    var blocked = currentStep === 3 && !hasCoverage();
    var hideNext = currentStep >= TOTAL_STEPS || currentStep === 5 || blocked;
    if (back) back.hidden = currentStep <= 1;
    if (next) next.hidden = hideNext;
    renderAuthActions();
  }

  function showStep(n, opts) {
    if (!wizard) return;
    opts = opts || {};
    n = Math.max(1, Math.min(TOTAL_STEPS, Number(n) || 1));
    var allowed = maxReachable();
    if (n > allowed) n = allowed;
    currentStep = n;
    if (n === 4 && state.timing === "urgent") assignUrgentSlot();
    if (n >= 5) calcQuote();
    paintWizard();
    saveDraft();
    if (!opts.silentScroll) {
      if (n === 3 && hasCoverage()) {
        // Keep "Buenas noticias" + kit choice in the same first view (below sticky header).
        requestAnimationFrame(function () {
          var card = document.getElementById("coverageYes");
          if (!card) return;
          var header = document.querySelector(".site-header") || document.querySelector("header");
          var offset = (header ? header.getBoundingClientRect().height : 72) + 12;
          var top = window.scrollY + card.getBoundingClientRect().top - offset;
          window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        });
      } else {
        window.scrollTo(0, 0);
      }
    }
    var nextHash = hashFor(n);
    if (location.hash !== nextHash) {
      // replaceState avoids stacking history when restoring from hash / draft.
      if (opts.replace || opts.fromHash) history.replaceState(null, "", "build.html" + nextHash);
      else location.hash = "step-" + n;
    }
  }

  function goIncomplete(hint) {
    var target = maxReachable();
    showStep(target);
    if (hint) {
      var confirmHint = document.getElementById("confirmHint");
      if (confirmHint && target === TOTAL_STEPS) {
        confirmHint.hidden = false;
        confirmHint.textContent = hint;
      }
    }
  }

  loadDraft();
  applyHostPropertyDefaults();

  /* --- Event wiring --- */
  document.querySelectorAll(".lang-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.lang = btn.getAttribute("data-lang");
      localStorage.setItem("hands-lang", state.lang);
      applyI18n();
      window.dispatchEvent(new CustomEvent("hands:langchange"));
    });
  });

  var citySelect = document.getElementById("citySelect");
  if (citySelect) {
    citySelect.addEventListener("change", function () {
      setCity(citySelect.value);
    });
  }

  ["serviceAddress", "serviceUnit", "serviceNeighborhood", "servicePhone", "serviceAccess"].forEach(
    function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", function () {
        setPlace();
        validatePlace(false);
      });
      el.addEventListener("blur", function () {
        setPlace();
        validatePlace(false);
      });
    }
  );

  var dateInput = document.getElementById("serviceDate");
  var timeSelect = document.getElementById("serviceTime");
  var B = window.HandsBookings;
  if (dateInput && B) {
    dateInput.min = B.ymd(new Date());
    if (!state.date) state.date = B.ymd(B.addDays(new Date(), 1));
    dateInput.value = state.date;
    fillTimeSlots();
    dateInput.addEventListener("change", function () {
      setWhen();
      fillTimeSlots();
      validateWhen(true);
    });
  }
  if (timeSelect) {
    timeSelect.addEventListener("change", function () {
      setWhen();
      validateWhen(true);
    });
  }

  var timeSlots = document.getElementById("timeSlots");
  if (timeSlots) {
    timeSlots.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-time]");
      if (!btn) return;
      pickTime(btn.getAttribute("data-time"));
    });
  }

  var otherSelect = document.getElementById("otherSelect");
  if (otherSelect) {
    otherSelect.addEventListener("change", function () {
      addOther(otherSelect.value);
      otherSelect.value = "";
    });
  }

  var otherChips = document.getElementById("otherChips");
  if (otherChips) {
    otherChips.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-remove-other]");
      if (!btn) return;
      removeOther(btn.getAttribute("data-remove-other"));
    });
  }

  document.querySelectorAll(".size-card").forEach(function (card) {
    card.addEventListener("click", function () {
      setSize(card.getAttribute("data-size"));
      popSize(card);
    });
  });

  document.querySelectorAll(".intensity-card").forEach(function (card) {
    card.addEventListener("click", function () {
      setIntensity(card.getAttribute("data-intensity"));
    });
  });

  document.querySelectorAll(".supplies-card").forEach(function (card) {
    card.addEventListener("click", function () {
      setSupplies(card.getAttribute("data-supplies"));
      popSupplies(card);
    });
  });

  document.querySelectorAll(".timing-card").forEach(function (card) {
    card.addEventListener("click", function () {
      setTiming(card.getAttribute("data-timing"));
      popTiming(card);
    });
  });

  document.querySelectorAll('input[name="extra"]').forEach(function (input) {
    input.addEventListener("change", function () {
      extrasSelected();
      calcQuote();
      saveDraft();
    });
  });

  var acceptProposal = document.getElementById("acceptProposal");
  if (acceptProposal) {
    acceptProposal.addEventListener("click", function () {
      if (!whenComplete()) {
        goIncomplete(dict().quoteNeedWhen);
        return;
      }
      proposalAccepted = true;
      saveDraft();
      showStep(6, { replace: true });
    });
  }

  var counterProposal = document.getElementById("counterProposal");
  if (counterProposal) {
    counterProposal.addEventListener("click", function () {
      var hint = document.getElementById("counterHint");
      if (hint) {
        hint.hidden = false;
        hint.textContent = dict().proposalCounterSoon;
      }
    });
  }

  var confirmBtn = document.getElementById("confirmBtn");
  var confirmHint = document.getElementById("confirmHint");
  if (confirmBtn && confirmHint) {
    confirmBtn.addEventListener("click", function () {
      if (!hasCoverage() || !placeComplete()) {
        goIncomplete(dict().quoteNeedAddress);
        return;
      }
      if (!whenComplete()) {
        goIncomplete(dict().quoteNeedWhen);
        return;
      }
      if (!proposalAccepted) {
        showStep(5);
        return;
      }
      if (!window.HandsAuth || !window.HandsAuth.isLoggedIn()) {
        saveDraft();
        confirmHint.hidden = false;
        confirmHint.textContent = dict().quoteNeedLogin;
        window.location.href = "login.html?next=" + encodeURIComponent("build.html#step-6");
        return;
      }
      var session = window.HandsAuth.getSession();
      var quote = quoteTotals();
      if (window.HandsBookings) {
        window.HandsBookings.create({
          hostName: session.name,
          hostEmail: session.email,
          city: state.city,
          address: state.address,
          unit: state.unit,
          neighborhood: state.neighborhood,
          phone: state.phone,
          access: state.access,
          size: state.size,
          intensity: state.intensity,
          date: state.date,
          time: state.time,
          timing: state.timing,
          supplies: state.supplies === "yes" ? "yes" : "no",
          kit: state.supplies === "kit",
          extras: extrasSelected(),
          other: state.other.slice(),
          total: quote.total,
        });
      }
      clearDraft();
      confirmBtn.disabled = true;
      confirmHint.hidden = false;
      confirmHint.textContent = dict().quoteBooked;
      window.location.href = "bookings.html";
    });
  }

  var wizardNext = document.getElementById("wizardNext");
  var wizardBack = document.getElementById("wizardBack");
  if (wizardNext) {
    wizardNext.addEventListener("click", function () {
      if (!validateStep(currentStep)) return;
      showStep(currentStep + 1);
    });
  }
  if (wizardBack) {
    wizardBack.addEventListener("click", function () {
      if (currentStep === 6) proposalAccepted = false;
      showStep(currentStep - 1);
    });
  }

  if (wizard) {
    window.addEventListener("hashchange", function () {
      var fromHash = stepFromHash();
      if (!fromHash) return;
      showStep(fromHash, { fromHash: true });
    });
  }

  var pdfLink = document.querySelector('[data-i18n="trustPdf"]');
  if (pdfLink) {
    pdfLink.setAttribute("href", "booking-detail.html?id=job-demo-showcase");
  }

  var menuBtn = document.getElementById("menuBtn");
  var siteNav = document.getElementById("siteNav");
  if (menuBtn && siteNav) {
    menuBtn.addEventListener("click", function () {
      var open = siteNav.classList.toggle("is-open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    siteNav.addEventListener("click", function (ev) {
      var target = ev.target;
      if (!target) return;
      var link = target.closest ? target.closest("a") : null;
      var logout = target.closest ? target.closest("[data-logout]") : null;
      if (!link && !logout) return;
      siteNav.classList.remove("is-open");
      menuBtn.setAttribute("aria-expanded", "false");
    });
  }

  loadAdminTrades();
  if (window.HandsVisits) window.HandsVisits.track();
  fillCitySelect();
  if (dateInput && B && !state.date) {
    state.date = B.ymd(B.addDays(new Date(), 1));
    dateInput.value = state.date;
  }
  applyI18n();
  if (wizard) {
    var hashed = stepFromHash();
    showStep(hashed || currentStep, { replace: true, silentScroll: true });
    var selected = document.querySelector(".size-card.is-selected");
    if (selected) popSize(selected);
  }
  calcQuote();

  /* Results gallery filters */
  var resultsFilters = document.getElementById("resultsFilters");
  var resultsGallery = document.getElementById("resultsGallery");
  if (resultsFilters && resultsGallery) {
    resultsFilters.addEventListener("click", function (event) {
      var chip = event.target.closest("[data-filter]");
      if (!chip) return;
      var filter = chip.getAttribute("data-filter");
      resultsFilters.querySelectorAll(".chip").forEach(function (el) {
        el.classList.toggle("is-active", el === chip);
      });
      resultsGallery.querySelectorAll(".before-after-card").forEach(function (card) {
        var cats = (card.getAttribute("data-category") || "").split(/\s+/);
        var show = filter === "all" || cats.indexOf(filter) !== -1;
        card.hidden = !show;
      });
    });
  }
})();
