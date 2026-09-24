/**
 * Booking detail page — loads one HandsBookings job by ?id=.
 *
 * Access: host may only view own bookings; admin may view any.
 * Photos come from HandsBookings.publishedPhotos(job) only when report.published,
 * grouped by space (before / after). Host rating uses setRating when published.
 */
(function () {
  var content = document.getElementById("bookingDetailContent");
  var missing = document.getElementById("bookingDetailMissing");
  if (!content || !missing) return;

  var currentJobId = "";
  var selectedRating = 0;

  function dict() {
    return (window.HandsI18n && window.HandsI18n.dict()) || {};
  }

  function t(key, fallback) {
    return dict()[key] || fallback || key;
  }

  function queryId() {
    return new URLSearchParams(window.location.search).get("id") || "";
  }

  function formatCop(amount) {
    var n = Number(amount) || 0;
    try {
      return (
        n.toLocaleString(window.HandsI18n && window.HandsI18n.lang() === "en" ? "en-US" : "es-CO") +
        " COP"
      );
    } catch (e) {
      return n + " COP";
    }
  }

  function statusMeta(status) {
    var labels = {
      pending: t("bookingsStatusPending", "Pendiente"),
      assigned: t("bookingsStatusConfirmed", "Confirmada"),
      in_progress: t("bookingsStatusInProgress", "En curso"),
      completed: t("bookingsStatusDone", "Completada"),
      cancelled: t("bookingsStatusCancelled", "Cancelada"),
    };
    var chip = "status-chip";
    if (status === "completed") chip += " is-done";
    else if (status === "pending" || status === "cancelled") chip += " is-pending";
    return { label: labels[status] || status, chip: chip };
  }

  function spaceLabel(space) {
    var labels = {
      kitchen: t("providerSpaceKitchen", "Cocina"),
      bathroom: t("providerSpaceBathroom", "Baño"),
      bedroom: t("providerSpaceBedroom", "Habitación"),
      living_room: t("providerSpaceLiving", "Sala"),
      dining_room: t("providerSpaceDining", "Comedor"),
      balcony: t("providerSpaceBalcony", "Balcón"),
    };
    return labels[space] || space || t("bookingDetailPhotos", "Servicio");
  }

  function typeLabel(type) {
    return type === "after"
      ? t("providerAfter", "Después")
      : t("providerBefore", "Antes");
  }

  function showMissing(messageKey) {
    content.hidden = true;
    missing.hidden = false;
    var lead = document.getElementById("bookingDetailMissingLead");
    if (lead && messageKey) lead.textContent = t(messageKey, lead.textContent);
  }

  function showContent() {
    missing.hidden = true;
    content.hidden = false;
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function canView(session, job) {
    if (!session || !job) return false;
    if (session.access === "admin") return true;
    return job.hostEmail === session.email;
  }

  function isHost(session) {
    return session && session.access === "host";
  }

  function renderPublishedEvidence(job) {
    var B = window.HandsBookings;
    var container = document.getElementById("bdPublishedPhotos");
    var message = document.getElementById("bdEvidenceMessage");

    if (!container || !message) return;

    container.innerHTML = "";

    if (!job.report || !job.report.published) {
      message.textContent = t(
        "bookingDetailEvidencePending",
        "El informe aún no está publicado."
      );
      return;
    }

    var photos = B.publishedPhotos(job);

    if (!photos.length) {
      message.textContent = t(
        "bookingDetailEvidenceEmpty",
        "El informe fue publicado, pero no contiene fotografías."
      );
      return;
    }

    message.textContent = t(
      "bookingDetailEvidenceReady",
      "Evidencia fotográfica del servicio."
    );

    var spaces = {};
    var order = [];
    photos.forEach(function (photo) {
      var space = photo.space || "other";
      if (!spaces[space]) {
        spaces[space] = { before: null, after: null, extra: [] };
        order.push(space);
      }
      if (photo.type === "before" && !spaces[space].before) {
        spaces[space].before = photo;
      } else if (photo.type === "after" && !spaces[space].after) {
        spaces[space].after = photo;
      } else {
        spaces[space].extra.push(photo);
      }
    });

    order.forEach(function (space) {
      var group = spaces[space];
      var section = document.createElement("section");
      section.className = "evidence-host-space";

      var heading = document.createElement("h3");
      heading.textContent = spaceLabel(space);
      section.appendChild(heading);

      var pair = document.createElement("div");
      pair.className = "evidence-host-pair";

      function addFigure(photo, fallbackType) {
        if (!photo) return;
        var figure = document.createElement("figure");
        figure.className = "photo-slot";
        var image = document.createElement("img");
        image.src = photo.url;
        image.alt = spaceLabel(space) + " · " + typeLabel(photo.type || fallbackType);
        var caption = document.createElement("figcaption");
        caption.textContent = typeLabel(photo.type || fallbackType);
        figure.appendChild(image);
        figure.appendChild(caption);
        pair.appendChild(figure);
      }

      addFigure(group.before, "before");
      addFigure(group.after, "after");
      group.extra.forEach(function (photo) {
        addFigure(photo, photo.type);
      });

      section.appendChild(pair);
      container.appendChild(section);
    });
  }

  function paintStars(score) {
    document.querySelectorAll("#bdStars .star-btn").forEach(function (btn) {
      var value = Number(btn.getAttribute("data-rating"));
      btn.classList.toggle("is-on", value <= score);
    });
  }

  function renderRating(job, session) {
    var message = document.getElementById("bdRatingMessage");
    var stars = document.getElementById("bdStars");
    var scoreEl = document.getElementById("bdRatingScore");
    var commentField = document.getElementById("bdRatingCommentField");
    var submit = document.getElementById("bdRatingSubmit");
    var comment = document.getElementById("bdRatingComment");
    var msg = document.getElementById("bdRatingMsg");

    if (!message || !stars) return;

    if (msg) {
      msg.hidden = true;
      msg.textContent = "";
    }

    var published = job.report && job.report.published;
    var hasRating = typeof job.rating === "number" && job.rating >= 1;

    if (hasRating) {
      selectedRating = job.rating;
      message.textContent = t("bookingDetailRatingDone", "Gracias por tu calificación.");
      stars.hidden = false;
      stars.classList.add("is-readonly");
      paintStars(job.rating);
      if (scoreEl) {
        scoreEl.hidden = false;
        scoreEl.textContent = String(job.rating);
      }
      if (commentField) commentField.hidden = true;
      if (submit) submit.hidden = true;
      if (comment && job.ratingComment) {
        message.textContent =
          t("bookingDetailRatingDone", "Gracias por tu calificación.") +
          (job.ratingComment ? " — " + job.ratingComment : "");
      }
      return;
    }

    stars.classList.remove("is-readonly");

    if (!published) {
      message.textContent = t(
        "bookingDetailRatingPending",
        "Podrás calificar cuando el informe esté publicado."
      );
      stars.hidden = true;
      if (scoreEl) scoreEl.hidden = true;
      if (commentField) commentField.hidden = true;
      if (submit) submit.hidden = true;
      return;
    }

    if (!isHost(session)) {
      message.textContent = t(
        "bookingDetailRatingHostOnly",
        "Solo el host puede calificar este servicio."
      );
      stars.hidden = true;
      if (scoreEl) scoreEl.hidden = true;
      if (commentField) commentField.hidden = true;
      if (submit) submit.hidden = true;
      return;
    }

    selectedRating = 0;
    message.textContent = t(
      "bookingDetailRatingPrompt",
      "Califica tu experiencia con este servicio."
    );
    stars.hidden = false;
    paintStars(0);
    if (scoreEl) {
      scoreEl.hidden = false;
      scoreEl.textContent = "—";
    }
    if (commentField) commentField.hidden = false;
    if (comment) comment.value = "";
    if (submit) submit.hidden = false;
  }

  function paint(job, session) {
    var B = window.HandsBookings;
    var status = B.jobStatus(job);
    var meta = statusMeta(status);
    currentJobId = job.id;

    setText("bdWhen", B.formatWhen(job.date, job.time));
    setText("bdCity", B.cityName(job.city));
    setText("bdPlace", B.formatPlace(job));
    setText("bdSize", B.sizeLabel(job.size));
    setText("bdIntensity", B.intensityLabel(job.intensity));
    setText("bdTotal", formatCop(job.total));

    var statusEl = document.getElementById("bdStatus");
    if (statusEl) {
      statusEl.className = meta.chip;
      statusEl.textContent = meta.label;
    }

    var staff = job.assigneeName
      ? t("bookingDetailStaffAssigned", "Personal asignado") + " · " + job.assigneeName
      : t("adminUnassigned", "Sin asignar");
    setText("bdStaff", staff);

    renderPublishedEvidence(job);
    renderRating(job, session);
    renderPdfButton(job);
    renderCancelButton(job, session);

    document.title = "Hands — " + t("bookingDetailTitle", "Detalle del servicio");
    showContent();
  }

  function renderPdfButton(job) {
    var btn = document.getElementById("bdPdfBtn");
    var hint = document.getElementById("bdPdfHint");
    if (!btn) return;
    var published = job.report && job.report.published;
    btn.disabled = !published;
    btn.setAttribute("aria-disabled", published ? "false" : "true");
    if (hint) hint.hidden = !published;
  }

  function renderCancelButton(job, session) {
    var btn = document.getElementById("bdCancelBtn");
    if (!btn || !window.HandsBookings) return;
    var can =
      isHost(session) && window.HandsBookings.hostCanCancel(job, session.email);
    btn.hidden = !can;
  }

  function render() {
    var session =
      window.HandsAuth && window.HandsAuth.getSession
        ? window.HandsAuth.getSession()
        : null;
    var id = queryId();
    var next =
      "booking-detail.html" + (id ? "?id=" + encodeURIComponent(id) : "");

    if (!session) {
      window.location.href = "login.html?next=" + encodeURIComponent(next);
      return;
    }

    if (!id || !window.HandsBookings) {
      showMissing("bookingDetailMissingLead");
      return;
    }

    var job = window.HandsBookings.get(id);
    if (!job || !canView(session, job)) {
      showMissing("bookingDetailMissingLead");
      return;
    }

    paint(job, session);
  }

  document.getElementById("bdStars").addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-rating]");
    if (!btn || document.getElementById("bdStars").classList.contains("is-readonly")) {
      return;
    }
    selectedRating = Number(btn.getAttribute("data-rating"));
    paintStars(selectedRating);
    var scoreEl = document.getElementById("bdRatingScore");
    if (scoreEl) scoreEl.textContent = String(selectedRating);
  });

  document.getElementById("bdRatingSubmit").addEventListener("click", function () {
    var msg = document.getElementById("bdRatingMsg");
    var B = window.HandsBookings;
    if (!B || !B.setRating || !currentJobId) return;

    if (!(selectedRating >= 1 && selectedRating <= 5)) {
      if (msg) {
        msg.hidden = false;
        msg.textContent = t(
          "bookingDetailRatingNeedStars",
          "Elige una calificación de 1 a 5."
        );
        msg.classList.add("is-error");
      }
      return;
    }

    var comment = (document.getElementById("bdRatingComment") || {}).value || "";
    var result = B.setRating(currentJobId, selectedRating, comment);
    if (!result.ok) {
      if (msg) {
        msg.hidden = false;
        msg.textContent = result.error || t("bookingDetailRatingFailed", "No se pudo guardar.");
        msg.classList.add("is-error");
      }
      return;
    }

    var session =
      window.HandsAuth && window.HandsAuth.getSession
        ? window.HandsAuth.getSession()
        : null;
    paint(result.job, session);
  });

  var pdfBtn = document.getElementById("bdPdfBtn");
  if (pdfBtn) {
    pdfBtn.addEventListener("click", function () {
      var msg = document.getElementById("bdRatingMsg");
      var B = window.HandsBookings;
      var Pdf = window.HandsReportPdf;
      if (!B || !Pdf || !currentJobId) return;

      var job = B.get(currentJobId);
      var result = Pdf.open(job);
      if (!result.ok && msg) {
        msg.hidden = false;
        msg.textContent = result.error || t("bookingDetailPdfBlocked");
        msg.classList.add("is-error");
      }
    });
  }

  var cancelBtn = document.getElementById("bdCancelBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", function () {
      var B = window.HandsBookings;
      var session =
        window.HandsAuth && window.HandsAuth.getSession
          ? window.HandsAuth.getSession()
          : null;
      if (!B || !session || !currentJobId) return;
      if (
        !window.confirm(
          t(
            "bookingsCancelConfirm",
            "¿Cancelar esta reserva? Esta acción no se puede deshacer."
          )
        )
      ) {
        return;
      }
      var result = B.cancelByHost(currentJobId, session.email);
      if (!result.ok) {
        window.alert(result.error || t("bookingsCancelFailed", "No se pudo cancelar."));
        return;
      }
      paint(result.job, session);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }

  window.addEventListener("hands:langchange", function () {
    if (!content.hidden) render();
  });
})();
