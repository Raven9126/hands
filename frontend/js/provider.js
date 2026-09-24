/**
 * Provider portal — assigned jobs and evidence submission.
 *
 * Gate: access === "provider". Uses HandsBookings.listByAssignee /
 * submitEvidence / pendingEvidenceCount / rejectedEvidenceCount.
 * Sample photos are paths under img/photos/. Rejected slots can be corrected.
 */
(function () {
  var Auth = window.HandsAuth;
  var B = window.HandsBookings;

  if (!Auth || !Auth.isLoggedIn()) {
    window.location.href = "login.html?next=provider.html";
    return;
  }

  var session = Auth.getSession();
  if (!session || session.access !== "provider") {
    if (session && session.access === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "index.html";
    }
    return;
  }

  if (!B) return;

  var SPACES = [
    { id: "kitchen", labelKey: "providerSpaceKitchen" },
    { id: "bathroom", labelKey: "providerSpaceBathroom" },
    { id: "bedroom", labelKey: "providerSpaceBedroom" },
  ];

  var DEMO_IMAGES = [
    { url: "img/photos/kitchen-before.jpg", labelKey: "providerImgKitchenBefore" },
    { url: "img/photos/kitchen-after.jpg", labelKey: "providerImgKitchenAfter" },
    { url: "img/photos/bathroom-before.jpg", labelKey: "providerImgBathroomBefore" },
    { url: "img/photos/bathroom-after.jpg", labelKey: "providerImgBathroomAfter" },
    { url: "img/photos/bedroom-before.jpg", labelKey: "providerImgBedroomBefore" },
    { url: "img/photos/bedroom-after.jpg", labelKey: "providerImgBedroomAfter" },
  ];

  var STATUS_KEYS = {
    pending: "adminStatusPending",
    assigned: "adminStatusAssigned",
    in_progress: "adminStatusInProgress",
    completed: "adminStatusCompleted",
    cancelled: "adminStatusCancelled",
  };

  var CHIP_CLASS = {
    completed: "is-done",
    pending: "is-pending",
    cancelled: "is-pending",
    assigned: "",
    in_progress: "",
  };

  var PHOTO_STATUS_KEYS = {
    pending: "evidenceStatusPending",
    approved: "evidenceStatusApproved",
    rejected: "evidenceStatusRejected",
  };

  var activeJobId = null;

  function dict() {
    return (window.HandsI18n && window.HandsI18n.dict()) || {};
  }

  function t(key) {
    return dict()[key] || key;
  }

  function applyI18n() {
    if (window.HandsI18n && window.HandsI18n.apply) window.HandsI18n.apply();
  }

  function canSubmitEvidence(job) {
    var status = B.jobStatus(job);
    return status === "assigned" || status === "in_progress" || status === "completed";
  }

  function latestPhoto(job, spaceId, type) {
    var photos = (job.evidence && job.evidence.photos) || [];
    var found = null;
    photos.forEach(function (photo) {
      if (photo.space === spaceId && photo.type === type) found = photo;
    });
    return found;
  }

  function rejectedCount(job) {
    return B.rejectedEvidenceCount ? B.rejectedEvidenceCount(job) : 0;
  }

  function showList() {
    activeJobId = null;
    document.getElementById("providerListView").hidden = false;
    document.getElementById("providerEvidenceView").hidden = true;
    document.getElementById("providerListView").classList.add("is-active");
    renderJobs();
  }

  function showEvidence(jobId) {
    var job = B.get(jobId);
    if (!job || (job.assigneeEmail || "").toLowerCase() !== session.email.toLowerCase()) {
      showList();
      return;
    }
    if (!canSubmitEvidence(job)) {
      showList();
      return;
    }

    activeJobId = jobId;
    document.getElementById("providerListView").hidden = true;
    document.getElementById("providerEvidenceView").hidden = false;
    document.getElementById("evidenceJobId").value = jobId;
    document.getElementById("evidenceNotes").value = (job.evidence && job.evidence.notes) || "";
    clearFormMsg();

    document.getElementById("providerEvidenceMeta").textContent =
      B.formatWhen(job.date, job.time) +
      " · " +
      B.cityName(job.city) +
      " · " +
      B.formatPlace(job);

    var title = document.getElementById("providerEvidenceTitle");
    var submitBtn = document.querySelector('#evidenceForm button[type="submit"]');
    var correcting = rejectedCount(job) > 0;
    if (title) {
      title.textContent = correcting
        ? t("providerEvidenceCorrectTitle")
        : t("providerEvidenceTitle");
    }
    if (submitBtn) {
      submitBtn.textContent = correcting
        ? t("providerSubmitCorrection")
        : t("providerSubmit");
    }

    buildSpaceFields(job);
    applyI18n();
  }

  function imageOptionsHtml(preferredUrl) {
    var html = '<option value="">' + t("providerPickPhoto") + "</option>";
    DEMO_IMAGES.forEach(function (img) {
      var selected = preferredUrl && preferredUrl === img.url ? " selected" : "";
      html +=
        '<option value="' +
        img.url +
        '"' +
        selected +
        ">" +
        t(img.labelKey) +
        "</option>";
    });
    return html;
  }

  function preferredUrl(spaceId, type) {
    var match = DEMO_IMAGES.find(function (img) {
      return img.url.indexOf(spaceId) !== -1 && img.url.indexOf(type) !== -1;
    });
    return match ? match.url : "";
  }

  function buildSpaceFields(job) {
    var root = document.getElementById("evidenceSpaces");
    root.innerHTML = "";

    var hasAny = job.evidence && job.evidence.photos && job.evidence.photos.length;
    var correcting = rejectedCount(job) > 0;

    if (correcting) {
      var banner = document.createElement("p");
      banner.className = "provider-correction-banner";
      banner.textContent = t("providerCorrectionLead");
      root.appendChild(banner);
    }

    SPACES.forEach(function (space) {
      var article = document.createElement("article");
      article.className = "evidence-space";
      article.innerHTML =
        "<h2>" +
        t(space.labelKey) +
        "</h2>" +
        '<div class="evidence-slots">' +
        slotHtml(job, space.id, "before", "providerBefore", hasAny) +
        slotHtml(job, space.id, "after", "providerAfter", hasAny) +
        "</div>";
      root.appendChild(article);
    });

    root.querySelectorAll("select[data-preview]").forEach(function (select) {
      select.addEventListener("change", function () {
        updatePreview(select);
      });
      updatePreview(select);
    });
  }

  function slotHtml(job, spaceId, type, labelKey, hasAny) {
    var latest = latestPhoto(job, spaceId, type);
    var status = latest ? latest.status : "";
    var previewId = spaceId + "-" + type + "-preview";

    if (status === "approved" || status === "pending") {
      return (
        '<div class="evidence-slot is-locked">' +
        "<label><span>" +
        t(labelKey) +
        "</span></label>" +
        '<p class="evidence-slot-status evidence-status-' +
        status +
        '">' +
        t(PHOTO_STATUS_KEYS[status] || "evidenceStatusPending") +
        "</p>" +
        '<div class="evidence-preview">' +
        (latest.url
          ? '<img src="' + latest.url + '" alt="" id="' + previewId + '" />'
          : "") +
        "</div>" +
        "</div>"
      );
    }

    var noteHtml = "";
    if (status === "rejected") {
      noteHtml =
        '<p class="evidence-slot-status evidence-status-rejected">' +
        t("evidenceStatusRejected") +
        "</p>";
      if (latest.reviewNote) {
        noteHtml +=
          '<p class="provider-reject-note">' +
          escapeHtml(latest.reviewNote) +
          "</p>";
      }
      noteHtml +=
        '<p class="provider-reject-hint">' + t("providerReplaceHint") + "</p>";
    }

    var preferred = status === "rejected" || hasAny ? "" : preferredUrl(spaceId, type);

    return (
      '<div class="evidence-slot' +
      (status === "rejected" ? " needs-correction" : "") +
      '">' +
      "<label>" +
      "<span>" +
      t(labelKey) +
      "</span>" +
      '<select name="' +
      spaceId +
      "-" +
      type +
      '" data-space="' +
      spaceId +
      '" data-type="' +
      type +
      '" data-preview="' +
      previewId +
      '">' +
      imageOptionsHtml(preferred) +
      "</select>" +
      "</label>" +
      noteHtml +
      '<div class="evidence-preview">' +
      '<img id="' +
      previewId +
      '" alt="" hidden />' +
      "</div>" +
      "</div>"
    );
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  function updatePreview(select) {
    var img = document.getElementById(select.getAttribute("data-preview"));
    if (!img) return;
    if (select.value) {
      img.src = select.value;
      img.hidden = false;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
    }
  }

  function clearFormMsg() {
    var el = document.getElementById("evidenceFormMsg");
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
    el.classList.remove("is-error", "is-ok");
  }

  function setFormMsg(text, ok) {
    var el = document.getElementById("evidenceFormMsg");
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || "";
    el.classList.toggle("is-error", !ok);
    el.classList.toggle("is-ok", !!ok);
  }

  function renderJobs() {
    var listEl = document.getElementById("providerJobs");
    var emptyEl = document.getElementById("providerEmpty");
    var jobs = B.listByAssignee(session.email);

    listEl.innerHTML = "";

    if (!jobs.length) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    jobs.forEach(function (job) {
      var status = B.jobStatus(job);
      var pending = B.pendingEvidenceCount(job);
      var rejected = rejectedCount(job);
      var chipClass = CHIP_CLASS[status] || "";
      var article = document.createElement("article");
      article.className = "provider-job";

      var evidenceLine = "";
      if (rejected > 0) {
        evidenceLine =
          '<p class="provider-job-evidence is-rejected">' +
          t("providerRejectedCount").replace("{n}", String(rejected)) +
          "</p>";
      } else if (pending > 0) {
        evidenceLine =
          '<p class="provider-job-evidence">' +
          t("providerPendingCount").replace("{n}", String(pending)) +
          "</p>";
      } else if (job.evidence && job.evidence.photos && job.evidence.photos.length) {
        evidenceLine =
          '<p class="provider-job-evidence">' + t("providerEvidenceSent") + "</p>";
      }

      var actions = "";
      if (canSubmitEvidence(job)) {
        var actionKey = "providerEvidenceRegister";
        if (rejected > 0) actionKey = "providerEvidenceCorrect";
        else if (pending > 0 || (job.evidence && job.evidence.photos.length)) {
          actionKey = "providerEvidenceContinue";
        }
        actions =
          '<button type="button" class="btn btn-primary" data-evidence="' +
          job.id +
          '">' +
          t(actionKey) +
          "</button>";
      }

      article.innerHTML =
        '<div class="provider-job-main">' +
        '<p class="provider-job-when">' +
        B.formatWhen(job.date, job.time) +
        "</p>" +
        '<p class="provider-job-place">' +
        B.cityName(job.city) +
        " · " +
        B.formatPlace(job) +
        "</p>" +
        '<p class="provider-job-size">' +
        B.sizeLabel(job.size) +
        " · " +
        B.intensityLabel(job.intensity) +
        "</p>" +
        '<p class="provider-job-host">' +
        t("providerHostLabel") +
        ": " +
        (job.hostName || "—") +
        "</p>" +
        evidenceLine +
        "</div>" +
        '<div class="provider-job-side">' +
        '<span class="status-chip ' +
        chipClass +
        '">' +
        t(STATUS_KEYS[status] || "adminStatusPending") +
        "</span>" +
        actions +
        "</div>";

      listEl.appendChild(article);
    });

    listEl.querySelectorAll("[data-evidence]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showEvidence(btn.getAttribute("data-evidence"));
      });
    });
  }

  function collectPhotos() {
    var selects = document.querySelectorAll("#evidenceSpaces select[data-space]");
    var photos = [];
    selects.forEach(function (select) {
      if (!select.value) return;
      photos.push({
        space: select.getAttribute("data-space"),
        type: select.getAttribute("data-type"),
        url: select.value,
      });
    });
    return photos;
  }

  function onSubmit(event) {
    event.preventDefault();
    clearFormMsg();

    var jobId = document.getElementById("evidenceJobId").value;
    var job = B.get(jobId);
    if (!job || (job.assigneeEmail || "").toLowerCase() !== session.email.toLowerCase()) {
      setFormMsg(t("providerSubmitForbidden"), false);
      return;
    }
    if (!canSubmitEvidence(job)) {
      setFormMsg(t("providerSubmitBlocked"), false);
      return;
    }

    var correcting = rejectedCount(job) > 0;
    var photos = collectPhotos();
    if (!photos.length) {
      setFormMsg(
        correcting ? t("providerNeedCorrection") : t("providerNeedPhotos"),
        false
      );
      return;
    }

    if (correcting) {
      var missing = false;
      SPACES.forEach(function (space) {
        ["before", "after"].forEach(function (type) {
          var latest = latestPhoto(job, space.id, type);
          if (latest && latest.status === "rejected") {
            var found = photos.some(function (p) {
              return p.space === space.id && p.type === type;
            });
            if (!found) missing = true;
          }
        });
      });
      if (missing) {
        setFormMsg(t("providerNeedAllRejected"), false);
        return;
      }
    }

    var notes = document.getElementById("evidenceNotes").value;
    var result = B.submitEvidence(jobId, { photos: photos, notes: notes });
    if (!result.ok) {
      setFormMsg(result.error || t("providerSubmitFailed"), false);
      return;
    }

    setFormMsg(
      correcting ? t("providerSubmitCorrectionOk") : t("providerSubmitOk"),
      true
    );
    window.setTimeout(function () {
      showList();
    }, 700);
  }

  /* --- Wire UI --- */
  document.getElementById("providerUserName").textContent = session.name || session.email;

  document.getElementById("providerLogout").addEventListener("click", function () {
    Auth.logout();
    window.location.href = "login.html";
  });

  document.getElementById("providerBack").addEventListener("click", function () {
    showList();
  });

  document.getElementById("evidenceForm").addEventListener("submit", onSubmit);

  document.querySelectorAll(".lang-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      localStorage.setItem("hands-lang", btn.getAttribute("data-lang"));
      applyI18n();
      if (activeJobId) {
        showEvidence(activeJobId);
      } else {
        renderJobs();
      }
    });
  });

  applyI18n();
  showList();
})();
