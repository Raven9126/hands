/**
 * HandsBookings — local store for service jobs.
 *
 * Responsibilities: seed/demo data, create jobs from the builder checkout,
 * explicit status lifecycle (pending → assigned → in_progress → completed /
 * cancelled), list/filter for the admin console, assign providers while
 * rejecting overlapping time windows, and evidence / report / rating fields
 * that stay separate from operational status.
 */
window.HandsBookings = (function () {
  /* --- Constants --- */
  var KEY = "hands-bookings";
  var SLOTS = [
    "07:00",
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
  ];
  /** Estimated job length (hours) by apartment size — used for overlap checks. */
  var DURATION = { xs: 2, sm: 3, md: 4, lg: 5 };
  /** Hours added or removed by cleaning intensity relative to size baseline. */
  var INTENSITY_HOURS = { light: -1, standard: 0, intense: 1 };
  var CITIES = {
    bogota: "Bogotá",
    cajica: "Cajicá",
    chia: "Chía",
    medellin: "Medellín",
    tunja: "Tunja",
    zipaquira: "Zipaquirá",
  };
  var SIZE_KEYS = { xs: "sizeXs", sm: "sizeSm", md: "sizeMd", lg: "sizeLg" };
  var INTENSITY_KEYS = {
    light: "intensityLight",
    standard: "intensityStandard",
    intense: "intensityIntense",
  };
  var PHOTO_STATUSES = ["pending", "approved", "rejected"];

  /* --- Date / time helpers --- */
  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function ymd(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  function parseMins(time) {
    var parts = String(time || "00:00").split(":");
    return Number(parts[0]) * 60 + Number(parts[1] || 0);
  }

  function dict() {
    return (window.HandsI18n && window.HandsI18n.dict()) || {};
  }

  function t(key) {
    return dict()[key] || key;
  }

  /** Prefer dictionary copy; fall back when the key is not wired yet. */
  function msg(key, fallback) {
    var value = t(key);
    return value === key ? fallback : value;
  }

  function locale() {
    return (window.HandsI18n && window.HandsI18n.lang() === "en") ? "en-US" : "es-CO";
  }

  function emptyEvidence() {
    return { photos: [], notes: "" };
  }

  function emptyReport() {
    return { photos: [], published: false };
  }

  function newPhotoId() {
    return "photo-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function migrateLegacyImgUrl(url) {
    var value = String(url || "");
    if (!value) return value;
    if (
      value.indexOf("img/brand/") === 0 ||
      value.indexOf("img/photos/") === 0 ||
      value.indexOf("img/diagrams/") === 0
    ) {
      return value;
    }
    if (value.indexOf("img/") !== 0) return value;
    var name = value.slice(4);
    if (/^hands-/.test(name) || name.indexOf("logo") !== -1) {
      return "img/brand/" + name;
    }
    if (/^flow-/.test(name)) {
      return "img/diagrams/" + name;
    }
    return "img/photos/" + name;
  }

  function normalizePhoto(photo) {
    if (!photo || typeof photo !== "object") return null;
    var status = photo.status;
    if (PHOTO_STATUSES.indexOf(status) === -1) status = "pending";
    var type = photo.type === "after" ? "after" : "before";
    return {
      id: photo.id || newPhotoId(),
      space: photo.space || "",
      type: type,
      url: migrateLegacyImgUrl(photo.url || ""),
      status: status,
      reviewNote: photo.reviewNote || "",
    };
  }

  /** Ensure every job has evidence / report / rating, including legacy localStorage rows. */
  function normalizeJob(job) {
    if (!job || typeof job !== "object") return job;
    var evidence = job.evidence && typeof job.evidence === "object" ? job.evidence : {};
    var report = job.report && typeof job.report === "object" ? job.report : {};
    var photos = Array.isArray(evidence.photos)
      ? evidence.photos.map(normalizePhoto).filter(Boolean)
      : [];
    var reportPhotos = Array.isArray(report.photos) ? report.photos.slice() : [];
    return Object.assign({}, job, {
      intensity: normalizeIntensity(job.intensity),
      evidence: {
        photos: photos,
        notes: evidence.notes != null ? String(evidence.notes) : "",
      },
      report: {
        photos: reportPhotos,
        published: !!report.published,
      },
      rating: typeof job.rating === "number" ? job.rating : null,
      ratingComment: job.ratingComment != null ? String(job.ratingComment) : "",
    });
  }

  function normalizeIntensity(value) {
    if (value === "light" || value === "intense" || value === "standard") return value;
    return "standard";
  }

  function findJobIndex(jobs, jobId) {
    var index = -1;
    jobs.forEach(function (job, i) {
      if (job.id === jobId) index = i;
    });
    return index;
  }

  /* --- Persistence --- */
  function seed() {
    var today = new Date();
    return [
      {
        id: "job-demo-1",
        createdAt: today.toISOString(),
        hostName: "Laura Host",
        hostEmail: "host@hands.co",
        city: "bogota",
        address: "Cra 7 # 32-16",
        unit: "Apto 801",
        neighborhood: "Chapinero",
        phone: "3001234567",
        access: "Portería. Dejar llaves en recepción.",
        size: "sm",
        intensity: "standard",
        date: ymd(today),
        time: "10:00",
        supplies: "yes",
        extras: ["linen"],
        other: [],
        total: 154560,
        status: "assigned",
        assigneeEmail: "carlos@hands.co",
        assigneeName: "Carlos Méndez",
      },
      {
        id: "job-demo-2",
        createdAt: today.toISOString(),
        hostName: "Marta Díaz",
        hostEmail: "marta@email.com",
        city: "chia",
        address: "Calle 3 # 4-20",
        unit: "Casa",
        neighborhood: "Centro",
        phone: "3105550102",
        access: "Timbre negro. Perro en patio.",
        size: "xs",
        intensity: "intense",
        date: ymd(addDays(today, 1)),
        time: "08:00",
        supplies: "no",
        extras: [],
        other: [],
        total: 128800,
        status: "pending",
        assigneeEmail: "",
        assigneeName: "",
      },
      {
        id: "job-demo-3",
        createdAt: today.toISOString(),
        hostName: "Andrés Pérez",
        hostEmail: "andres@email.com",
        city: "medellin",
        address: "Cra 43A # 1-50",
        unit: "Torre B, 1204",
        neighborhood: "El Poblado",
        phone: "3158882211",
        access: "Portería. Código 4580.",
        size: "md",
        intensity: "standard",
        date: ymd(addDays(today, 1)),
        time: "14:00",
        supplies: "yes",
        extras: ["restock"],
        other: [],
        total: 187040,
        status: "assigned",
        assigneeEmail: "diana@hands.co",
        assigneeName: "Diana Torres",
      },
      {
        id: "job-demo-4",
        createdAt: today.toISOString(),
        hostName: "Sofía Ríos",
        hostEmail: "sofia@email.com",
        city: "cajica",
        address: "Km 2 vía Tabio, conjunto Altos",
        unit: "Casa 18",
        neighborhood: "Canelón",
        phone: "3014447788",
        access: "Decir Hands en portería.",
        size: "lg",
        intensity: "light",
        date: ymd(addDays(today, 2)),
        time: "09:00",
        supplies: "yes",
        extras: [],
        other: ["jardinero"],
        total: 296800,
        status: "pending",
        assigneeEmail: "",
        assigneeName: "",
      },
      {
        id: "job-demo-5",
        createdAt: today.toISOString(),
        hostName: "Laura Host",
        hostEmail: "host@hands.co",
        city: "zipaquira",
        address: "Calle 3 # 7-45",
        unit: "Apto 302",
        neighborhood: "Centro Histórico",
        phone: "3001234567",
        access: "",
        size: "sm",
        intensity: "light",
        date: ymd(addDays(today, 3)),
        time: "11:00",
        supplies: "yes",
        extras: [],
        other: [],
        total: 134400,
        status: "assigned",
        assigneeEmail: "carlos@hands.co",
        assigneeName: "Carlos Méndez",
      },
      showcaseJob(today),
    ];
  }

  /**
   * Demo job ready for evaluators: completed → approved evidence → published report → rating.
   * Open as host@hands.co → booking-detail.html?id=job-demo-showcase
   */
  function showcaseJob(today) {
    var doneDay = addDays(today, -2);
    var photoIds = {
      kb: "photo-demo-kitchen-before",
      ka: "photo-demo-kitchen-after",
      bb: "photo-demo-bath-before",
      ba: "photo-demo-bath-after",
      rb: "photo-demo-bed-before",
      ra: "photo-demo-bed-after",
    };
    return {
      id: "job-demo-showcase",
      createdAt: addDays(today, -5).toISOString(),
      hostName: "Laura Host",
      hostEmail: "host@hands.co",
      city: "bogota",
      address: "Cra 11 # 93-07",
      unit: "Torre 2, apto 504",
      neighborhood: "Chicó",
      phone: "3001234567",
      access: "Conjunto: Parque Central. Portería — código 2048.",
      size: "md",
      intensity: "intense",
      date: ymd(doneDay),
      time: "09:00",
      supplies: "kit",
      extras: ["linen"],
      other: [],
      total: 201600,
      status: "completed",
      assigneeEmail: "carlos@hands.co",
      assigneeName: "Carlos Méndez",
      evidence: {
        notes: "Servicio completado. Espacios principales listos para check-in.",
        photos: [
          {
            id: photoIds.kb,
            space: "kitchen",
            type: "before",
            url: "img/photos/kitchen-before.jpg",
            status: "approved",
            reviewNote: "",
          },
          {
            id: photoIds.ka,
            space: "kitchen",
            type: "after",
            url: "img/photos/kitchen-after.jpg",
            status: "approved",
            reviewNote: "",
          },
          {
            id: photoIds.bb,
            space: "bathroom",
            type: "before",
            url: "img/photos/bathroom-before.jpg",
            status: "approved",
            reviewNote: "",
          },
          {
            id: photoIds.ba,
            space: "bathroom",
            type: "after",
            url: "img/photos/bathroom-after.jpg",
            status: "approved",
            reviewNote: "",
          },
          {
            id: photoIds.rb,
            space: "bedroom",
            type: "before",
            url: "img/photos/bedroom-before.jpg",
            status: "approved",
            reviewNote: "",
          },
          {
            id: photoIds.ra,
            space: "bedroom",
            type: "after",
            url: "img/photos/bedroom-after.jpg",
            status: "approved",
            reviewNote: "",
          },
        ],
      },
      report: {
        photos: [
          photoIds.kb,
          photoIds.ka,
          photoIds.bb,
          photoIds.ba,
          photoIds.rb,
          photoIds.ra,
        ],
        published: true,
      },
      rating: 5,
      ratingComment: "El apartamento quedó impecable y las fotos del servicio me dieron mucha tranquilidad.",
    };
  }

  /** Inject showcase job into existing localStorage so demos work without clearing data. */
  function ensureShowcase(jobs) {
    var list = Array.isArray(jobs) ? jobs.slice() : [];
    if (findJobIndex(list, "job-demo-showcase") !== -1) return list;
    list.unshift(normalizeJob(showcaseJob(new Date())));
    write(list);
    return list;
  }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw == null) {
        var seeded = seed().map(normalizeJob);
        write(seeded);
        return seeded;
      }
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return ensureShowcase(seed().map(normalizeJob));
      return ensureShowcase(parsed.map(normalizeJob));
    } catch (e) {
      return ensureShowcase(seed().map(normalizeJob));
    }
  }

  function write(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  function durationHours(sizeOrJob, intensity) {
    var size = sizeOrJob;
    var level = intensity;
    if (sizeOrJob && typeof sizeOrJob === "object") {
      size = sizeOrJob.size;
      level = sizeOrJob.intensity;
    }
    var base = DURATION[size] || 3;
    var adj = INTENSITY_HOURS[normalizeIntensity(level)] || 0;
    return Math.max(1, base + adj);
  }

  /** Half-open interval overlap: [a0, a1) intersects [b0, b1). */
  function overlaps(timeA, hoursA, timeB, hoursB) {
    var a0 = parseMins(timeA);
    var a1 = a0 + hoursA * 60;
    var b0 = parseMins(timeB);
    var b1 = b0 + hoursB * 60;
    return a0 < b1 && b0 < a1;
  }

  function cityName(id) {
    if (window.HandsCities && window.HandsCities.nameById) {
      return window.HandsCities.nameById(id);
    }
    return CITIES[id] || id || "—";
  }

  /**
   * Effective status is always the explicit job.status value.
   * Date is not used to invent in_progress / completed.
   */
  function jobStatus(job) {
    if (!job) return "pending";
    var status = job.status || "pending";
    var known = ["pending", "assigned", "in_progress", "completed", "cancelled"];
    if (known.indexOf(status) === -1) return "pending";
    if (status === "assigned" && !job.assigneeEmail) return "pending";
    return status;
  }

  /** Next statuses Admin may set manually (assignment uses assign()). */
  function allowedTransitions(from) {
    var map = {
      pending: ["cancelled"],
      assigned: ["in_progress", "cancelled"],
      in_progress: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
    };
    return map[from] || [];
  }

  function setStatus(jobId, nextStatus) {
    var known = ["pending", "assigned", "in_progress", "completed", "cancelled"];
    if (known.indexOf(nextStatus) === -1) {
      return { ok: false, error: t("adminStatusInvalid") };
    }
    var jobs = read();
    var index = findJobIndex(jobs, jobId);
    if (index === -1) return { ok: false, error: t("adminAssignMissing") };

    var current = jobStatus(jobs[index]);
    var allowed = allowedTransitions(current);
    if (allowed.indexOf(nextStatus) === -1) {
      return { ok: false, error: t("adminStatusBlocked") };
    }
    if (nextStatus === "in_progress" && !jobs[index].assigneeEmail) {
      return { ok: false, error: t("adminStatusNeedAssignee") };
    }

    jobs[index] = Object.assign({}, jobs[index], { status: nextStatus });
    write(jobs);
    return { ok: true, job: jobs[index] };
  }

  /**
   * Host may cancel only before the job starts (pending or assigned).
   */
  function cancelByHost(jobId, hostEmail) {
    var jobs = read();
    var index = findJobIndex(jobs, jobId);
    if (index === -1) {
      return { ok: false, error: msg("bookingsCancelMissing", "No encontramos esa reserva.") };
    }
    var job = jobs[index];
    var email = String(hostEmail || "").trim().toLowerCase();
    if (!email || String(job.hostEmail || "").toLowerCase() !== email) {
      return {
        ok: false,
        error: msg("bookingsCancelForbidden", "No puedes cancelar esta reserva."),
      };
    }
    var status = jobStatus(job);
    if (status !== "pending" && status !== "assigned") {
      return {
        ok: false,
        error: msg(
          "bookingsCancelBlocked",
          "Solo puedes cancelar reservas pendientes o confirmadas (antes de iniciar)."
        ),
      };
    }
    jobs[index] = Object.assign({}, job, { status: "cancelled" });
    write(jobs);
    return { ok: true, job: jobs[index] };
  }

  function hostCanCancel(job, hostEmail) {
    if (!job || !hostEmail) return false;
    if (String(job.hostEmail || "").toLowerCase() !== String(hostEmail).toLowerCase()) {
      return false;
    }
    var status = jobStatus(job);
    return status === "pending" || status === "assigned";
  }

  function sizeLabel(size) {
    var key = SIZE_KEYS[size];
    return (key && dict()[key]) || size;
  }

  function intensityLabel(intensity) {
    var key = INTENSITY_KEYS[normalizeIntensity(intensity)];
    return (key && dict()[key]) || intensity || dict().intensityStandard || "Estándar";
  }

  function formatPlace(job) {
    var parts = [];
    if (!job) return "—";
    if (job.address) parts.push(job.address);
    if (job.unit) parts.push(job.unit);
    if (job.neighborhood) parts.push(job.neighborhood);
    return parts.length ? parts.join(" · ") : "—";
  }

  function formatWhen(date, time) {
    if (!date || !time) return "—";
    var parsed = new Date(date + "T00:00:00");
    if (isNaN(parsed.getTime())) return date + " · " + time;
    return parsed.toLocaleDateString(locale(), {
      weekday: "short",
      day: "numeric",
      month: "short",
    }) + " · " + time;
  }

  /* --- Validation & queries --- */
  function validateDate(value) {
    if (!value) return { ok: false, error: t("valDateRequired") };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false, error: t("valDateRequired") };
    if (value < ymd(new Date())) return { ok: false, error: t("valDatePast") };
    return { ok: true, error: "" };
  }

  function validateTime(date, time) {
    if (!time) return { ok: false, error: t("valTimeRequired") };
    if (SLOTS.indexOf(time) === -1) return { ok: false, error: t("valTimeRequired") };
    if (date === ymd(new Date()) && parseMins(time) <= parseMins(pad(new Date().getHours()) + ":" + pad(new Date().getMinutes()))) {
      return { ok: false, error: t("valTimePast") };
    }
    return { ok: true, error: "" };
  }

  /** Slots still in the future for the given date (local clock). */
  function availableSlots(date) {
    var today = ymd(new Date());
    var nowMins = parseMins(pad(new Date().getHours()) + ":" + pad(new Date().getMinutes()));
    return SLOTS.filter(function (slot) {
      if (date === today && parseMins(slot) <= nowMins) return false;
      return true;
    });
  }

  function list() {
    return read().slice().sort(function (a, b) {
      if (a.date === b.date) return a.time.localeCompare(b.time);
      return a.date.localeCompare(b.date);
    });
  }

  function byDate(dateStr) {
    return list().filter(function (job) {
      return job.date === dateStr;
    });
  }

  function unassigned() {
    return list().filter(function (job) {
      return job.status !== "assigned" || !job.assigneeEmail;
    });
  }

  function monthCounts(year, month) {
    var prefix = year + "-" + pad(month + 1);
    var map = {};
    read().forEach(function (job) {
      if (job.date.slice(0, 7) !== prefix) return;
      if (!map[job.date]) map[job.date] = { total: 0, pending: 0 };
      map[job.date].total += 1;
      if (job.status !== "assigned" || !job.assigneeEmail) map[job.date].pending += 1;
    });
    return map;
  }

  /* --- Mutations --- */
  function create(payload) {
    var job = normalizeJob({
      id: "job-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
      createdAt: new Date().toISOString(),
      hostName: payload.hostName || "",
      hostEmail: payload.hostEmail || "",
      city: payload.city || "",
      address: payload.address || "",
      unit: payload.unit || "",
      neighborhood: payload.neighborhood || "",
      phone: payload.phone || "",
      access: payload.access || "",
      size: payload.size || "sm",
      intensity: normalizeIntensity(payload.intensity),
      date: payload.date,
      time: payload.time,
      timing: payload.timing || "scheduled",
      supplies: payload.supplies || "yes",
      kit: !!payload.kit,
      extras: payload.extras || [],
      other: payload.other || [],
      total: payload.total || 0,
      status: "pending",
      assigneeEmail: "",
      assigneeName: "",
      evidence: emptyEvidence(),
      report: emptyReport(),
      rating: null,
      ratingComment: "",
    });
    var jobs = read();
    jobs.push(job);
    write(jobs);
    return job;
  }

  function get(id) {
    return read().find(function (job) {
      return job.id === id;
    }) || null;
  }

  /* --- Evidence / report / rating (separate from operational status) --- */

  /** Jobs assigned to a provider — for the future provider portal. */
  function listByAssignee(email) {
    if (!email) return [];
    var needle = String(email).toLowerCase();
    return list().filter(function (job) {
      return (job.assigneeEmail || "").toLowerCase() === needle;
    });
  }

  /**
   * Provider submits evidence photos. Always stored as pending.
   * Does not touch report. Appends to existing evidence.photos.
   */
  function submitEvidence(jobId, payload) {
    payload = payload || {};
    var jobs = read();
    var index = findJobIndex(jobs, jobId);
    if (index === -1) return { ok: false, error: t("adminAssignMissing") };

    var incoming = Array.isArray(payload.photos) ? payload.photos : [];
    var newPhotos = incoming
      .map(function (p) {
        if (!p || !p.space || !p.url) return null;
        return normalizePhoto({
          id: newPhotoId(),
          space: p.space,
          type: p.type,
          url: p.url,
          status: "pending",
          reviewNote: "",
        });
      })
      .filter(Boolean);

    if (!newPhotos.length) {
      return {
        ok: false,
        error: msg("evidencePhotosRequired", "Agrega al menos una fotografía válida."),
      };
    }

    var prev = jobs[index].evidence || emptyEvidence();
    var evidence = {
      photos: prev.photos.concat(newPhotos),
      notes: payload.notes != null ? String(payload.notes) : prev.notes || "",
    };

    jobs[index] = Object.assign({}, jobs[index], { evidence: evidence });
    write(jobs);
    return { ok: true, job: jobs[index] };
  }

  /** Admin only: pending → approved | rejected. Rejected photos are not re-approved in place. */
  function reviewPhoto(jobId, photoId, status, note) {
    if (status !== "approved" && status !== "rejected") {
      return {
        ok: false,
        error: msg("evidenceReviewInvalid", "La revisión debe ser approved o rejected."),
      };
    }
    var jobs = read();
    var index = findJobIndex(jobs, jobId);
    if (index === -1) return { ok: false, error: t("adminAssignMissing") };

    var photos = (jobs[index].evidence.photos || []).slice();
    var pIndex = -1;
    photos.forEach(function (p, i) {
      if (p.id === photoId) pIndex = i;
    });
    if (pIndex === -1) {
      return {
        ok: false,
        error: msg("evidencePhotoMissing", "Fotografía no encontrada."),
      };
    }
    if (photos[pIndex].status !== "pending") {
      return {
        ok: false,
        error: msg(
          "evidenceReviewBlocked",
          "Solo se pueden revisar fotografías pendientes."
        ),
      };
    }

    photos[pIndex] = Object.assign({}, photos[pIndex], {
      status: status,
      reviewNote: note != null ? String(note) : photos[pIndex].reviewNote || "",
    });

    jobs[index] = Object.assign({}, jobs[index], {
      evidence: {
        photos: photos,
        notes: jobs[index].evidence.notes || "",
      },
    });
    write(jobs);
    return { ok: true, job: jobs[index] };
  }

  /**
   * Admin saves which approved photos belong in the report draft.
   * Does not publish — report.published stays unchanged.
   */
  function saveReportSelection(jobId, photoIds) {
    var jobs = read();
    var index = findJobIndex(jobs, jobId);
    if (index === -1) return { ok: false, error: t("adminAssignMissing") };

    var selected = Array.isArray(photoIds) ? photoIds : [];
    var evidencePhotos = jobs[index].evidence.photos || [];
    var validIds = [];

    selected.forEach(function (photoId) {
      var match = evidencePhotos.some(function (photo) {
        return photo.id === photoId && photo.status === "approved";
      });
      if (match && validIds.indexOf(photoId) === -1) validIds.push(photoId);
    });

    var prevReport = jobs[index].report || emptyReport();
    jobs[index] = Object.assign({}, jobs[index], {
      report: {
        photos: validIds,
        published: !!prevReport.published,
      },
    });
    write(jobs);
    return { ok: true, job: jobs[index] };
  }

  /**
   * Admin publishes a host-facing report from approved photo ids only.
   * report.photos stores ids; published gates host visibility.
   */
  function publishReport(jobId, photoIds) {
    var jobs = read();
    var index = findJobIndex(jobs, jobId);
    if (index === -1) return { ok: false, error: t("adminAssignMissing") };

    var ids = Array.isArray(photoIds) ? photoIds : [];
    var byId = {};
    (jobs[index].evidence.photos || []).forEach(function (p) {
      byId[p.id] = p;
    });

    var selected = [];
    for (var i = 0; i < ids.length; i++) {
      var photo = byId[ids[i]];
      if (!photo || photo.status !== "approved") {
        return {
          ok: false,
          error: msg(
            "evidencePublishOnlyApproved",
            "Solo se pueden publicar fotografías aprobadas."
          ),
        };
      }
      if (selected.indexOf(ids[i]) === -1) selected.push(ids[i]);
    }

    jobs[index] = Object.assign({}, jobs[index], {
      report: { photos: selected, published: true },
    });
    write(jobs);
    return { ok: true, job: jobs[index] };
  }

  /** Host rating — prepared on the model; UI can wire later. */
  function setRating(jobId, score, comment) {
    var jobs = read();
    var index = findJobIndex(jobs, jobId);
    if (index === -1) return { ok: false, error: t("adminAssignMissing") };

    var n = Number(score);
    if (!(n >= 1 && n <= 5)) {
      return {
        ok: false,
        error: msg("evidenceRatingInvalid", "La calificación debe ser entre 1 y 5."),
      };
    }

    jobs[index] = Object.assign({}, jobs[index], {
      rating: n,
      ratingComment: comment != null ? String(comment) : "",
    });
    write(jobs);
    return { ok: true, job: jobs[index] };
  }

  /** Photos the host may see: report published + ids resolve to approved evidence. */
  function publishedPhotos(job) {
    if (!job || !job.report || !job.report.published) return [];
    var byId = {};
    ((job.evidence && job.evidence.photos) || []).forEach(function (p) {
      byId[p.id] = p;
    });
    return (job.report.photos || [])
      .map(function (id) {
        return byId[id];
      })
      .filter(function (p) {
        return p && p.status === "approved";
      });
  }

  function pendingEvidenceCount(job) {
    if (!job || !job.evidence || !Array.isArray(job.evidence.photos)) return 0;
    return job.evidence.photos.filter(function (p) {
      return p.status === "pending";
    }).length;
  }

  function rejectedEvidenceCount(job) {
    if (!job || !job.evidence || !Array.isArray(job.evidence.photos)) return 0;
    return job.evidence.photos.filter(function (p) {
      return p.status === "rejected";
    }).length;
  }

  /** False when the provider already has an overlapping job that day. */
  function canAssign(jobId, email, date, time) {
    var job = get(jobId);
    if (!job || !email) return false;
    var hours = durationHours(job);
    var dateStr = date || job.date;
    var timeStr = time || job.time;
    return !read().some(function (other) {
      if (other.id === jobId) return false;
      if (other.assigneeEmail !== email) return false;
      if (other.date !== dateStr) return false;
      return overlaps(timeStr, hours, other.time, durationHours(other));
    });
  }

  function assign(jobId, payload) {
    var jobs = read();
    var index = findJobIndex(jobs, jobId);
    if (index === -1) return { ok: false, error: t("adminAssignMissing") };
    var next = Object.assign({}, jobs[index], {
      date: payload.date || jobs[index].date,
      time: payload.time || jobs[index].time,
      assigneeEmail: payload.assigneeEmail || "",
      assigneeName: payload.assigneeName || "",
      status: payload.assigneeEmail ? "assigned" : "pending",
    });
    if (next.assigneeEmail && !canAssign(jobId, next.assigneeEmail, next.date, next.time)) {
      return { ok: false, error: t("adminAssignConflict") };
    }
    jobs[index] = next;
    write(jobs);
    return { ok: true, job: next };
  }

  return {
    SLOTS: SLOTS,
    CITIES: CITIES,
    pad: pad,
    ymd: ymd,
    addDays: addDays,
    durationHours: durationHours,
    cityName: cityName,
    jobStatus: jobStatus,
    sizeLabel: sizeLabel,
    intensityLabel: intensityLabel,
    formatPlace: formatPlace,
    formatWhen: formatWhen,
    validateDate: validateDate,
    validateTime: validateTime,
    availableSlots: availableSlots,
    list: list,
    byDate: byDate,
    unassigned: unassigned,
    monthCounts: monthCounts,
    create: create,
    get: get,
    listByAssignee: listByAssignee,
    submitEvidence: submitEvidence,
    reviewPhoto: reviewPhoto,
    saveReportSelection: saveReportSelection,
    publishReport: publishReport,
    setRating: setRating,
    publishedPhotos: publishedPhotos,
    pendingEvidenceCount: pendingEvidenceCount,
    rejectedEvidenceCount: rejectedEvidenceCount,
    canAssign: canAssign,
    assign: assign,
    setStatus: setStatus,
    cancelByHost: cancelByHost,
    hostCanCancel: hostCanCancel,
    allowedTransitions: allowedTransitions,
  };
})();

/* --- Bookings page: render host reservations from HandsBookings --- */
document.addEventListener("DOMContentLoaded", function () {
  var bookingsList = document.querySelector(".bookings-list");
  var bookingsEmpty = document.querySelector(".bookings-empty");

  if (!bookingsList) return;

  var session =
    window.HandsAuth && window.HandsAuth.getSession
      ? window.HandsAuth.getSession()
      : null;

  if (!session) {
    bookingsList.innerHTML = "";
    if (bookingsEmpty) {
      bookingsEmpty.hidden = false;
    }
    return;
  }

  var jobs = window.HandsBookings.list().filter(function (job) {
    return job.hostEmail === session.email;
  });

  bookingsList.innerHTML = "";

  if (!jobs.length) {
    if (bookingsEmpty) {
      bookingsEmpty.hidden = false;
    }
    return;
  }

  if (bookingsEmpty) {
    bookingsEmpty.hidden = true;
  }

  var statusLabels = {
    completed: "Completada",
    pending: "Pendiente",
    cancelled: "Cancelada",
    in_progress: "En curso",
    assigned: "Confirmada",
  };
  var dict =
    window.HandsI18n && window.HandsI18n.dict ? window.HandsI18n.dict() : {};
  if (dict.bookingsStatusDone) statusLabels.completed = dict.bookingsStatusDone;
  if (dict.bookingsStatusPending) statusLabels.pending = dict.bookingsStatusPending;
  if (dict.bookingsStatusConfirmed) statusLabels.assigned = dict.bookingsStatusConfirmed;
  if (dict.bookingsStatusInProgress) statusLabels.in_progress = dict.bookingsStatusInProgress;
  if (dict.bookingsStatusCancelled) statusLabels.cancelled = dict.bookingsStatusCancelled;

  jobs.forEach(function (job) {
    var row = document.createElement("article");
    row.className = "booking-row";

    var meta = document.createElement("div");
    meta.className = "booking-meta";

    var date = document.createElement("span");
    date.textContent = HandsBookings.formatWhen(job.date, job.time);

    var city = document.createElement("span");
    city.textContent = HandsBookings.cityName(job.city);

    var status = document.createElement("span");
    status.className = "status-chip";

    var currentStatus = HandsBookings.jobStatus(job);

    if (currentStatus === "completed") {
      status.classList.add("is-done");
    } else if (currentStatus === "pending" || currentStatus === "cancelled") {
      status.classList.add("is-pending");
    }

    status.textContent =
      statusLabels[currentStatus] || statusLabels.assigned || "Confirmada";

    meta.appendChild(date);
    meta.appendChild(city);
    meta.appendChild(status);

    var actions = document.createElement("div");
    actions.className = "booking-row-actions";

    var link = document.createElement("a");
    link.href = "booking-detail.html?id=" + encodeURIComponent(job.id);
    link.textContent = dict.bookingsViewLink || "Ver reserva →";
    actions.appendChild(link);

    if (HandsBookings.hostCanCancel(job, session.email)) {
      var cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn-text booking-cancel-btn";
      cancelBtn.textContent = dict.bookingsCancel || "Cancelar";
      cancelBtn.setAttribute("data-cancel-id", job.id);
      actions.appendChild(cancelBtn);
    }

    row.appendChild(meta);
    row.appendChild(actions);

    bookingsList.appendChild(row);
  });

  bookingsList.addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-cancel-id]");
    if (!btn) return;
    var jobId = btn.getAttribute("data-cancel-id");
    var confirmMsg =
      dict.bookingsCancelConfirm ||
      "¿Cancelar esta reserva? Esta acción no se puede deshacer.";
    if (!window.confirm(confirmMsg)) return;
    var result = HandsBookings.cancelByHost(jobId, session.email);
    if (!result.ok) {
      window.alert(result.error || dict.bookingsCancelFailed || "No se pudo cancelar.");
      return;
    }
    window.location.reload();
  });
});
