/**
 * Admin console for Hands operations.
 *
 * Responsibilities:
 * - Gate access to authenticated users with access === "admin".
 * - Dashboard KPIs (jobs, revenue, visits, hosts/providers).
 * - Service job list/calendar and provider assignment.
 * - CRUD for service roles, directory users, and coverage cities.
 *
 * Depends on HandsAuth, HandsValidate, HandsBookings, HandsI18n,
 * HandsCities, and HandsVisits (loaded before this script).
 */
(function () {
  /* --- Auth gate --- */
  if (!window.HandsAuth || !window.HandsAuth.isLoggedIn()) {
    window.location.href = "login.html?next=admin.html";
    return;
  }
  var session = window.HandsAuth.getSession();
  if (!session || session.access !== "admin") {
    window.location.href = "index.html";
    return;
  }

  /* --- Shared deps & state --- */
  var V = window.HandsValidate;
  var B = window.HandsBookings;
  var STORAGE_ROLES = "hands-service-roles";
  var STORAGE_USERS = "hands-users";
  // System roles are fixed and cannot be removed.
  var SYSTEM_ROLE_IDS = ["admin", "host", "provider"];
  var DEFAULT_SERVICE_ROLES = [
    { id: "cleaner", name: "Cleaner", description: "Limpieza y turnover entre huéspedes." },
  ];
  var TITLE_KEYS = {
    home: "adminTitleHome",
    services: "adminTitleServices",
    providers: "adminTitleProviders",
    users: "adminTitleUsers",
    roles: "adminTitleRoles",
    cities: "adminTitleCities",
  };
  var STATUS_KEYS = {
    pending: "adminStatusPending",
    assigned: "adminStatusAssigned",
    in_progress: "adminStatusInProgress",
    completed: "adminStatusCompleted",
    cancelled: "adminStatusCancelled",
  };
  var currentPanel = "home";
  var servicesView = "list";
  var jobFilter = "all";
  var userFilter = "all";
  var bindings = [];
  var calCursor = new Date();
  var calSelected = B ? B.ymd(new Date()) : "";
  var chartRange = "7d";
  var jobsChartInstance = null;

  function t(key) {
    return V.t(key);
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  /** ASCII slug for role ids; strips diacritics and caps length for storage keys. */
  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }

  var serviceRoles = readJson(STORAGE_ROLES, DEFAULT_SERVICE_ROLES);
  var users = readJson(STORAGE_USERS, [
    { name: "Ana Ruiz", email: "ana@hands.co", access: "admin", services: [] },
    { name: "Carlos Méndez", email: "carlos@hands.co", access: "provider", services: ["cleaner"] },
    { name: "Diana Torres", email: "diana@hands.co", access: "provider", services: ["cleaner"] },
    { name: "Laura Host", email: "laura.host@email.com", access: "host", services: [] },
  ]);

  /* --- Roles & directory helpers --- */
  function systemRoles() {
    return [
      { id: "admin", name: "Admin", description: t("adminSysAdmin") },
      { id: "host", name: "Host", description: t("adminSysHost") },
      { id: "provider", name: t("adminAccessProvider"), description: t("adminSysProvider") },
    ];
  }

  function roleNameById(id) {
    var found = serviceRoles.find(function (r) {
      return r.id === id;
    });
    return found ? found.name : id;
  }

  /** True if the email exists in the admin directory or HandsAuth accounts. */
  function emailTaken(email) {
    var needle = String(email || "").trim().toLowerCase();
    if (users.some(function (u) {
      return u.email === needle;
    })) {
      return true;
    }
    return !!(window.HandsAuth && window.HandsAuth.findByEmail(needle));
  }

  function slugTaken(id) {
    if (SYSTEM_ROLE_IDS.indexOf(id) !== -1) return true;
    return serviceRoles.some(function (r) {
      return r.id === id;
    });
  }

  /** Escape before interpolating into admin HTML templates. */
  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  function formatCop(n) {
    return "$" + Math.round(n || 0).toLocaleString("es-CO");
  }

  function locale() {
    return window.HandsI18n.lang() === "en" ? "en-US" : "es-CO";
  }

  /**
   * Prefer HandsBookings.jobStatus; local fallback uses explicit job.status only.
   */
  function jobStatus(job) {
    if (B && B.jobStatus) return B.jobStatus(job);
    if (!job) return "pending";
    var status = job.status || "pending";
    var known = ["pending", "assigned", "in_progress", "completed", "cancelled"];
    if (known.indexOf(status) === -1) return "pending";
    if (status === "assigned" && !job.assigneeEmail) return "pending";
    return status;
  }

  function assignButtonHtml(job) {
    var status = jobStatus(job);
    if (status === "completed" || status === "cancelled") return "";
    return (
      '<button type="button" class="btn btn-ghost" data-assign-job="' +
      escapeHtml(job.id) +
      '">' +
      (job.assigneeEmail ? t("adminAssignChange") : t("adminAssign")) +
      "</button>"
    );
  }

  function statusActionsHtml(job) {
    if (!B || !B.allowedTransitions) return "";
    var current = jobStatus(job);
    var next = B.allowedTransitions(current);
    if (!next.length) return "";
    var options =
      '<option value="">' +
      escapeHtml(t("adminStatusChange")) +
      "</option>" +
      next
        .map(function (status) {
          return (
            '<option value="' +
            escapeHtml(status) +
            '">' +
            escapeHtml(statusLabel(status)) +
            "</option>"
          );
        })
        .join("");
    return (
      '<label class="status-action"><select data-set-status="' +
      escapeHtml(job.id) +
      '" aria-label="' +
      escapeHtml(t("adminStatusChange")) +
      '">' +
      options +
      "</select></label>"
    );
  }

  function statusLabel(status) {
    return t(STATUS_KEYS[status] || "adminFilterPending");
  }

  function statusClass(status) {
    return "status-pill is-" + (status || "pending");
  }

  function photoSpaceLabel(space) {
    var keys = {
      kitchen: "providerSpaceKitchen",
      bathroom: "providerSpaceBathroom",
      bedroom: "providerSpaceBedroom",
      living_room: "providerSpaceLiving",
      dining_room: "providerSpaceDining",
      balcony: "providerSpaceBalcony",
    };
    if (keys[space]) return t(keys[space]);
    return space || t("evidenceSpaceFallback");
  }

  function photoTypeLabel(type) {
    return type === "after" ? t("providerAfter") : t("providerBefore");
  }

  function photoStatusLabel(status) {
    var keys = {
      pending: "evidenceStatusPending",
      approved: "evidenceStatusApproved",
      rejected: "evidenceStatusRejected",
    };
    return t(keys[status] || "") || status;
  }

  function evidenceButtonHtml(job) {
    var count = B && B.pendingEvidenceCount ? B.pendingEvidenceCount(job) : 0;
    if (!job.evidence || !job.evidence.photos || !job.evidence.photos.length) {
      return "";
    }
    return (
      '<button type="button" class="btn btn-ghost" data-review-evidence="' +
      escapeHtml(job.id) +
      '">' +
      t("evidenceReviewBtn") +
      (count ? " (" + count + ")" : "") +
      "</button>"
    );
  }

  function renderEvidenceReview(job) {
    var view = document.getElementById("evidenceReviewView");
    var content = document.getElementById("evidenceReviewContent");
    var title = document.getElementById("evidenceReviewTitle");
    var meta = document.getElementById("evidenceReviewMeta");

    if (!view || !content || !title || !meta) return;

    var photos =
      job.evidence && Array.isArray(job.evidence.photos) ? job.evidence.photos : [];

    title.textContent = t("evidenceReviewTitle");
    meta.textContent =
      (job.hostName || t("evidenceReviewFallbackHost")) +
      " · " +
      (B && B.cityName ? B.cityName(job.city) : job.city || t("evidenceReviewFallbackCity")) +
      " · " +
      (job.date || "") +
      (job.time ? " · " + job.time : "");

    if (!photos.length) {
      content.innerHTML =
        '<p class="role-empty">' + t("evidenceReviewEmpty") + "</p>";
      return;
    }

    var spaces = {};
    photos.forEach(function (photo) {
      var space = photo.space || "other";
      if (!spaces[space]) spaces[space] = [];
      spaces[space].push(photo);
    });

    var html = "";
    Object.keys(spaces).forEach(function (space) {
      html +=
        '<div class="admin-block evidence-space">' +
        '<div class="admin-block-head">' +
        "<h3>" +
        escapeHtml(photoSpaceLabel(space)) +
        "</h3>" +
        "<p>" +
        spaces[space].length +
        " " +
        t("evidencePhotosCount") +
        "</p>" +
        "</div>" +
        '<div class="evidence-grid">';

      spaces[space].forEach(function (photo) {
        html +=
          '<article class="evidence-card">' +
          '<div class="evidence-photo">' +
          '<img src="' +
          escapeHtml(photo.url) +
          '" alt="' +
          escapeHtml(photoSpaceLabel(space) + " · " + photoTypeLabel(photo.type)) +
          '">' +
          "</div>" +
          '<div class="evidence-card-body">' +
          "<strong>" +
          escapeHtml(photoTypeLabel(photo.type)) +
          "</strong>" +
          '<span class="evidence-status evidence-status-' +
          escapeHtml(photo.status) +
          '">' +
          escapeHtml(photoStatusLabel(photo.status)) +
          "</span>";

        if (photo.reviewNote) {
          html +=
            '<p class="evidence-review-note">' +
            escapeHtml(photo.reviewNote) +
            "</p>";
        }

        if (photo.status === "approved" && !(job.report && job.report.published)) {
          var selectedForReport =
            job.report &&
            Array.isArray(job.report.photos) &&
            job.report.photos.indexOf(photo.id) !== -1;
          html +=
            '<label class="evidence-select">' +
            '<input type="checkbox" ' +
            'data-report-photo="' +
            escapeHtml(photo.id) +
            '" ' +
            'data-job-id="' +
            escapeHtml(job.id) +
            '"' +
            (selectedForReport ? " checked" : "") +
            ">" +
            "<span>" +
            t("evidenceIncludeReport") +
            "</span>" +
            "</label>";
        } else if (
          photo.status === "approved" &&
          job.report &&
          Array.isArray(job.report.photos) &&
          job.report.photos.indexOf(photo.id) !== -1
        ) {
          html +=
            '<p class="evidence-select-locked">' +
            t("evidenceIncludedReport") +
            "</p>";
        }

        html += '<div class="evidence-actions">';

        if (photo.status === "pending") {
          html +=
            '<button type="button" class="btn btn-primary" ' +
            'data-approve-photo="' +
            escapeHtml(photo.id) +
            '" ' +
            'data-job-id="' +
            escapeHtml(job.id) +
            '">' +
            t("evidenceApprove") +
            "</button>" +
            '<button type="button" class="btn btn-ghost" ' +
            'data-reject-photo="' +
            escapeHtml(photo.id) +
            '" ' +
            'data-job-id="' +
            escapeHtml(job.id) +
            '">' +
            t("evidenceReject") +
            "</button>";
        }

        html += "</div></div></article>";
      });

      html += "</div></div>";
    });

    if (job.report && job.report.published) {
      html +=
        '<div class="admin-block evidence-report-actions">' +
        '<div class="admin-block-head">' +
        "<h3>" +
        t("evidenceReportTitle") +
        "</h3>" +
        "<p>" +
        t("evidenceReportPublishedLead") +
        "</p>" +
        "</div>" +
        '<p class="evidence-report-status">' +
        t("evidenceReportPublishedStatus") +
        "</p>" +
        "</div>";
    } else {
      var selectedCount =
        job.report && Array.isArray(job.report.photos) ? job.report.photos.length : 0;

      html +=
        '<div class="admin-block evidence-report-actions">' +
        '<div class="admin-block-head">' +
        "<h3>" +
        t("evidenceReportTitle") +
        "</h3>" +
        "<p>" +
        t("evidenceReportSelectLead") +
        "</p>" +
        "</div>" +
        '<button type="button" class="btn btn-primary" ' +
        'data-save-report-selection="' +
        escapeHtml(job.id) +
        '">' +
        t("evidenceSaveSelection") +
        "</button>" +
        "<p>" +
        (selectedCount === 1
          ? t("evidenceSelectedOne").replace("{n}", "1")
          : t("evidenceSelectedMany").replace("{n}", String(selectedCount))) +
        "</p>" +
        (selectedCount > 0
          ? '<button type="button" class="btn btn-primary" ' +
            'data-publish-report="' +
            escapeHtml(job.id) +
            '">' +
            t("evidencePublishReport") +
            "</button>"
          : "<p>" + t("evidenceNoSelection") + "</p>") +
        "</div>";
    }

    content.innerHTML = html;
  }

  /**
   * Providers from the admin directory merged with HandsAuth accounts
   * (deduped by email). Seeds a demo provider when the list is empty.
   */
  function providers() {
    var list = users.filter(function (u) {
      return u.access === "provider";
    });
    try {
      var accounts = JSON.parse(localStorage.getItem("hands-accounts") || "[]");
      accounts.forEach(function (account) {
        if (account.access !== "provider") return;
        if (list.some(function (u) {
          return u.email === account.email;
        })) {
          return;
        }
        list.push({
          name: account.name,
          email: account.email,
          access: "provider",
          services: account.services || [],
        });
      });
    } catch (e) {}
    if (!list.length) {
      list = [
        {
          name: "Carlos Méndez",
          email: "carlos@hands.co",
          access: "provider",
          services: ["cleaner"],
        },
      ];
    }
    return list;
  }

  function allHosts() {
    var list = users.filter(function (u) {
      return u.access === "host";
    });
    try {
      var accounts = JSON.parse(localStorage.getItem("hands-accounts") || "[]");
      accounts.forEach(function (account) {
        if (account.access !== "host") return;
        if (list.some(function (u) {
          return u.email === account.email;
        })) {
          return;
        }
        list.push(account);
      });
    } catch (e) {}
    return list;
  }

  function paintHeader() {
    var nameEl = document.getElementById("adminUserName");
    var roleEl = document.getElementById("adminUserRole");
    if (nameEl) nameEl.textContent = session.name || session.email || "—";
    if (roleEl) roleEl.textContent = t("adminAccessAdmin");
  }

  /* --- Roles panel --- */
  function renderSystemRoles() {
    var list = document.getElementById("systemRoles");
    if (!list) return;
    list.innerHTML = systemRoles()
      .map(function (role) {
        return (
          '<li class="role-item"><div><strong>' +
          role.name +
          '</strong><span class="role-slug">' +
          role.id +
          "</span><p>" +
          role.description +
          '</p></div><span class="pill">' +
          t("adminLocked") +
          "</span></li>"
        );
      })
      .join("");
  }

  function renderServiceRoles() {
    var list = document.getElementById("serviceRoles");
    if (!list) return;
    if (!serviceRoles.length) {
      list.innerHTML = '<li class="role-empty">' + t("adminSvcEmpty") + "</li>";
      return;
    }
    list.innerHTML = serviceRoles
      .map(function (role) {
        return (
          '<li class="role-item"><div><strong>' +
          role.name +
          '</strong><span class="role-slug">' +
          role.id +
          "</span><p>" +
          (role.description || t("adminNoDesc")) +
          '</p></div><button type="button" class="btn-link" data-remove-role="' +
          role.id +
          '">' +
          t("adminRemove") +
          "</button></li>"
        );
      })
      .join("");
  }

  function renderServiceChecks() {
    var box = document.getElementById("serviceRoleChecks");
    if (!box) return;
    if (!serviceRoles.length) {
      box.innerHTML = '<p class="field-hint">' + t("adminSvcNeedRole") + "</p>";
      return;
    }
    box.innerHTML = serviceRoles
      .map(function (role) {
        return (
          '<label class="check"><input type="checkbox" name="serviceRole" value="' +
          role.id +
          '" /><span>' +
          role.name +
          "</span></label>"
        );
      })
      .join("");
  }

  function accessLabel(access) {
    if (access === "admin") return t("adminAccessAdmin");
    if (access === "host") return t("adminAccessHost");
    return t("adminAccessProvider");
  }

  /* --- Users & providers panels --- */
  function renderUsers() {
    var body = document.getElementById("userTable");
    if (!body) return;
    var filtered = users.filter(function (user) {
      return userFilter === "all" || user.access === userFilter;
    });
    if (!filtered.length) {
      body.innerHTML =
        '<tr><td colspan="3" class="role-empty">' + t("adminUsersEmpty") + "</td></tr>";
      return;
    }
    body.innerHTML = filtered
      .map(function (user) {
        var services =
          user.services && user.services.length
            ? user.services.map(roleNameById).join(", ")
            : "—";
        return (
          "<tr><td>" +
          escapeHtml(user.name) +
          "</td><td>" +
          escapeHtml(user.email) +
          '</td><td><span class="tag">' +
          accessLabel(user.access) +
          "</span> " +
          escapeHtml(services) +
          "</td></tr>"
        );
      })
      .join("");
  }

  function renderProviders() {
    var body = document.getElementById("providerTable");
    var empty = document.getElementById("providersEmpty");
    if (!body) return;
    var list = providers();
    var jobs = B ? B.list() : [];
    if (!list.length) {
      body.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    body.innerHTML = list
      .map(function (person) {
        var trades = (person.services || []).map(roleNameById).join(", ") || "—";
        var count = jobs.filter(function (job) {
          return job.assigneeEmail === person.email;
        }).length;
        return (
          "<tr><td>" +
          escapeHtml(person.name) +
          "<br><small>" +
          escapeHtml(person.email) +
          "</small></td><td>" +
          escapeHtml(trades) +
          '</td><td><span class="status-pill is-assigned">' +
          t("adminProviderActive") +
          "</span></td><td>" +
          count +
          "</td></tr>"
        );
      })
      .join("");
  }

  /* --- Cities panel --- */
  function renderCities() {
    var body = document.getElementById("cityTable");
    if (!body || !window.HandsCities) return;
    var cities = window.HandsCities.list(true);
    body.innerHTML = cities
      .map(function (city) {
        var active = city.active !== false;
        return (
          "<tr><td>" +
          escapeHtml(city.name) +
          '</td><td><span class="status-pill ' +
          (active ? "is-assigned" : "is-cancelled") +
          '">' +
          (active ? t("adminCityActive") : t("adminCityInactive")) +
          '</span></td><td class="city-actions">' +
          '<button type="button" class="btn btn-ghost" data-toggle-city="' +
          escapeHtml(city.id) +
          '" data-active="' +
          (active ? "0" : "1") +
          '">' +
          (active ? t("adminCityDeactivate") : t("adminCityActivate")) +
          '</button><button type="button" class="btn-link" data-remove-city="' +
          escapeHtml(city.id) +
          '">' +
          t("adminRemove") +
          "</button></td></tr>"
        );
      })
      .join("");
  }

  /* --- Dashboard --- */
  function renderHome() {
    if (!B) return;
    var jobs = B.list();
    var today = B.ymd(new Date());
    var now = new Date();
    var monthPrefix =
      now.getFullYear() +
      "-" +
      (now.getMonth() + 1 < 10 ? "0" : "") +
      (now.getMonth() + 1);

    var todayJobs = jobs.filter(function (j) {
      return j.date === today;
    });
    var pending = jobs.filter(function (j) {
      return jobStatus(j) === "pending";
    });
    var progress = jobs.filter(function (j) {
      return jobStatus(j) === "in_progress";
    });
    var doneToday = todayJobs.filter(function (j) {
      return jobStatus(j) === "completed";
    });
    var monthJobs = jobs.filter(function (j) {
      return String(j.date || "").indexOf(monthPrefix) === 0;
    });
    var monthRevenue = monthJobs.reduce(function (sum, j) {
      return sum + (Number(j.total) || 0);
    }, 0);

    setText("kpiToday", todayJobs.length);
    setText("kpiPending", pending.length);
    setText("kpiProgress", progress.length);
    setText("kpiDone", doneToday.length);
    setText("kpiMonth", monthJobs.length);
    setText("kpiRevenue", formatCop(monthRevenue));
    setText("kpiProviders", providers().length);
    setText("kpiHosts", allHosts().length);
    setText("kpiVisits", window.HandsVisits ? window.HandsVisits.total() : 0);
    setText("kpiVisitsToday", window.HandsVisits ? window.HandsVisits.today() : 0);

    var list = document.getElementById("homeTodayList");
    if (list) {
      list.innerHTML = todayJobs.length
        ? todayJobs.map(function (job) {
            return jobCard(job, false);
          }).join("")
        : '<p class="job-empty">' + t("adminHomeTodayEmpty") + "</p>";
    }

    renderDashboardChart(jobs);
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  function chartDayCount(rangeKey) {
    if (rangeKey === "90d") return 90;
    if (rangeKey === "30d") return 30;
    return 7;
  }

  /** Builds daily revenue + job counts for the selected range. */
  function chartSeries(jobs, rangeKey) {
    var days = chartDayCount(rangeKey);
    var now = new Date();
    var labels = [];
    var revenue = [];
    var counts = [];
    var dense = days > 14;

    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      var key = B.ymd(d);
      var dayJobs = jobs.filter(function (j) {
        return j.date === key;
      });
      var sum = dayJobs.reduce(function (acc, j) {
        return acc + (Number(j.total) || 0);
      }, 0);
      labels.push(
        dense
          ? d.toLocaleDateString(locale(), { day: "numeric", month: "short" })
          : d.toLocaleDateString(locale(), { weekday: "short", day: "numeric" })
      );
      revenue.push(sum);
      counts.push(dayJobs.length);
    }

    return { labels: labels, revenue: revenue, counts: counts };
  }

  /**
   * Dual-axis line chart (revenue + services), matching StyleFactory's Chart.js pattern.
   */
  function renderDashboardChart(jobs) {
    var canvas = document.getElementById("jobsChart");
    if (!canvas || typeof Chart === "undefined" || !B) return;

    var series = chartSeries(jobs || B.list(), chartRange);
    if (jobsChartInstance) {
      jobsChartInstance.destroy();
      jobsChartInstance = null;
    }

    jobsChartInstance = new Chart(canvas, {
      type: "line",
      data: {
        labels: series.labels,
        datasets: [
          {
            label: t("adminChartRevenue"),
            data: series.revenue,
            borderColor: "#1f5c44",
            backgroundColor: "rgba(31, 92, 68, 0.12)",
            fill: true,
            tension: 0.3,
            yAxisID: "y",
          },
          {
            label: t("adminChartJobs"),
            data: series.counts,
            borderColor: "#c4a35a",
            borderDash: [5, 4],
            fill: false,
            tension: 0.3,
            yAxisID: "y2",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: chartRange === "7d" ? 7 : 10,
              color: "#5c6b73",
            },
            grid: { color: "rgba(31, 92, 68, 0.08)" },
          },
          y: {
            position: "left",
            ticks: {
              color: "#5c6b73",
              callback: function (value) {
                return "$" + Number(value).toLocaleString("es-CO");
              },
            },
            grid: { color: "rgba(31, 92, 68, 0.1)" },
          },
          y2: {
            position: "right",
            grid: { display: false },
            ticks: {
              color: "#5c6b73",
              precision: 0,
            },
          },
        },
      },
    });
  }

  /* --- Services list & calendar --- */
  function renderServicesList() {
    var body = document.getElementById("servicesTableBody");
    if (!body || !B) return;
    var jobs = B.list()
      .slice()
      .sort(function (a, b) {
        if (a.date === b.date) return String(a.time).localeCompare(String(b.time));
        return String(a.date).localeCompare(String(b.date));
      })
      .filter(function (job) {
        return jobFilter === "all" || jobStatus(job) === jobFilter;
      });

    if (!jobs.length) {
      body.innerHTML =
        '<tr><td colspan="6" class="role-empty">' + t("adminServicesEmpty") + "</td></tr>";
      return;
    }

    body.innerHTML = jobs
      .map(function (job) {
        var status = jobStatus(job);
        var when =
          escapeHtml(job.date) +
          " · " +
          escapeHtml(job.time || "—");
        return (
          "<tr><td>" +
          when +
          "</td><td>" +
          escapeHtml(job.hostName || job.hostEmail || "—") +
          "</td><td>" +
          escapeHtml(B.cityName(job.city)) +
          " · " +
          escapeHtml(B.formatPlace(job)) +
          '</td><td><span class="' +
          statusClass(status) +
          '">' +
          statusLabel(status) +
          "</span></td><td>" +
          escapeHtml(job.assigneeName || t("adminUnassigned")) +
          '</td><td class="admin-job-actions">' +
          assignButtonHtml(job) +
          statusActionsHtml(job) +
          evidenceButtonHtml(job) +
          "</td></tr>"
        );
      })
      .join("");
  }

  function weekdayLabels() {
    var labels = [];
    for (var i = 0; i < 7; i++) {
      labels.push(
        new Date(2026, 8, 14 + i).toLocaleDateString(locale(), { weekday: "short" })
      );
    }
    return labels;
  }

  function jobCard(job, compact) {
    if (!B) return "";
    var status = jobStatus(job);
    var assigned = !!job.assigneeEmail;
    var hours = B.durationHours(job);
    var extras = (job.other || []).map(roleNameById).filter(Boolean);
    var dateBit = "";
    if (compact) {
      var parsed = new Date(job.date + "T00:00:00");
      dateBit =
        " · " +
        (isNaN(parsed.getTime())
          ? job.date
          : parsed.toLocaleDateString(locale(), { day: "numeric", month: "short" }));
    }
    return (
      '<article class="job-card' +
      (assigned ? "" : " is-pending") +
      '"><p class="job-time">' +
      escapeHtml(job.time) +
      " · " +
      hours +
      " " +
      t("adminHours") +
      dateBit +
      "</p><h3>" +
      escapeHtml(job.hostName || job.hostEmail) +
      '</h3><p class="job-meta">' +
      escapeHtml(B.cityName(job.city)) +
      " · " +
      escapeHtml(B.formatPlace(job)) +
      " · " +
      escapeHtml(B.sizeLabel(job.size)) +
      " · " +
      escapeHtml(B.intensityLabel(job.intensity)) +
      " · " +
      formatCop(job.total) +
      (extras.length ? " · " + extras.map(escapeHtml).join(", ") : "") +
      '</p><p class="job-assignee"><span class="' +
      statusClass(status) +
      '">' +
      statusLabel(status) +
      "</span> · " +
      (assigned
        ? t("adminAssignedTo") + " " + escapeHtml(job.assigneeName)
        : t("adminUnassigned")) +
      '</p><div class="job-actions">' +
      assignButtonHtml(job) +
      statusActionsHtml(job) +
      "</div></article>"
    );
  }

  function fillAssignTimes(date, selected) {
    var select = document.getElementById("assignTime");
    if (!select || !B) return;
    select.innerHTML = B.SLOTS.map(function (slot) {
      return (
        '<option value="' +
        slot +
        '"' +
        (slot === selected ? " selected" : "") +
        ">" +
        slot +
        "</option>"
      );
    }).join("");
  }

  function fillAssignProviders(selectedEmail) {
    var select = document.getElementById("assignProvider");
    if (!select) return;
    var options = '<option value="">' + t("adminAssignProviderPh") + "</option>";
    options += providers()
      .map(function (person) {
        var trades = (person.services || []).map(roleNameById).join(", ");
        return (
          '<option value="' +
          escapeHtml(person.email) +
          '"' +
          (person.email === selectedEmail ? " selected" : "") +
          ">" +
          escapeHtml(person.name) +
          (trades ? " · " + escapeHtml(trades) : "") +
          "</option>"
        );
      })
      .join("");
    select.innerHTML = options;
  }

  function closeAssign() {
    var form = document.getElementById("assignForm");
    if (!form) return;
    form.hidden = true;
    document.getElementById("assignJobId").value = "";
    showMsg("assignMsg", "", true);
  }

  function openAssign(id) {
    if (!B) return;
    var job = B.get(id);
    if (!job) return;
    setServicesView("calendar");
    var form = document.getElementById("assignForm");
    form.hidden = false;
    document.getElementById("assignJobId").value = job.id;
    document.getElementById("assignJobSummary").textContent =
      (job.hostName || job.hostEmail) +
      " · " +
      B.formatPlace(job) +
      (job.phone ? " · " + job.phone : "") +
      " · " +
      B.cityName(job.city) +
      " · " +
      B.sizeLabel(job.size) +
      " · " +
      B.intensityLabel(job.intensity);
    document.getElementById("assignDate").value = job.date;
    fillAssignProviders(job.assigneeEmail);
    fillAssignTimes(job.date, job.time);
    showMsg("assignMsg", "", true);
    document.getElementById("assignProviderError").textContent = "";
    form.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function renderDayJobs() {
    var box = document.getElementById("calDayJobs");
    var title = document.getElementById("calDayTitle");
    if (!box || !B) return;
    var parsed = new Date(calSelected + "T00:00:00");
    title.textContent = isNaN(parsed.getTime())
      ? t("adminTitleCalendar")
      : parsed.toLocaleDateString(locale(), {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
    var jobs = B.byDate(calSelected);
    box.innerHTML = jobs.length
      ? jobs
          .map(function (job) {
            return jobCard(job, false);
          })
          .join("")
      : '<p class="job-empty">' + t("adminCalEmpty") + "</p>";
  }

  function renderUnassigned() {
    var box = document.getElementById("unassignedList");
    if (!box || !B) return;
    var jobs = B.unassigned();
    box.innerHTML = jobs.length
      ? jobs
          .map(function (job) {
            return jobCard(job, true);
          })
          .join("")
      : '<p class="job-empty">' + t("adminCalNonePending") + "</p>";
  }

  function renderCalendar() {
    var grid = document.getElementById("calGrid");
    if (!B || !grid) return;
    var year = calCursor.getFullYear();
    var month = calCursor.getMonth();
    document.getElementById("calMonthLabel").textContent = calCursor.toLocaleDateString(
      locale(),
      { month: "long", year: "numeric" }
    );
    document.getElementById("calWeekdays").innerHTML = weekdayLabels()
      .map(function (label) {
        return "<span>" + escapeHtml(label) + "</span>";
      })
      .join("");
    var first = new Date(year, month, 1);
    var startOffset = (first.getDay() + 6) % 7;
    var start = new Date(year, month, 1 - startOffset);
    var counts = B.monthCounts(year, month);
    var today = B.ymd(new Date());
    var html = "";
    for (var i = 0; i < 42; i++) {
      var day = B.addDays(start, i);
      var iso = B.ymd(day);
      var info = counts[iso];
      var cls = "cal-cell";
      if (day.getMonth() !== month) cls += " is-muted";
      if (iso === today) cls += " is-today";
      if (iso === calSelected) cls += " is-selected";
      if (info) cls += " has-jobs";
      var marks = "";
      if (info) {
        if (info.pending) marks += '<i class="is-pending"></i>';
        if (info.total - info.pending > 0) marks += "<i></i>";
      }
      html +=
        '<button type="button" class="' +
        cls +
        '" data-cal-date="' +
        iso +
        '"><span class="cal-num">' +
        day.getDate() +
        '</span><span class="cal-marks">' +
        marks +
        "</span></button>";
    }
    grid.innerHTML = html;
    renderDayJobs();
    renderUnassigned();
  }

  function setServicesView(view) {
    servicesView = view;
    document.querySelectorAll("[data-services-view]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-services-view") === view);
    });
    var listView = document.getElementById("servicesListView");
    var calView = document.getElementById("servicesCalView");
    var evidenceView = document.getElementById("evidenceReviewView");
    if (listView) listView.hidden = view !== "list";
    if (calView) calView.hidden = view !== "calendar";
    if (evidenceView) evidenceView.hidden = true;
    if (view === "calendar") renderCalendar();
    else renderServicesList();
  }

  /** Persist directory state and repaint every panel that depends on it. */
  function persistAndRefresh() {
    writeJson(STORAGE_ROLES, serviceRoles);
    writeJson(STORAGE_USERS, users);
    paintHeader();
    renderSystemRoles();
    renderServiceRoles();
    renderServiceChecks();
    renderUsers();
    renderProviders();
    renderCities();
    renderHome();
    if (servicesView === "calendar") renderCalendar();
    else renderServicesList();
  }

  function showMsg(id, text, ok) {
    var el = document.getElementById(id);
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || "";
    el.classList.toggle("is-error", !ok);
  }

  function applyI18n() {
    window.HandsI18n.apply();
    document.getElementById("adminTitle").textContent = t(TITLE_KEYS[currentPanel]);
    bindings.forEach(function (b) {
      b.refresh();
    });
    persistAndRefresh();
  }

  function showPanel(panel) {
    currentPanel = panel;
    document.querySelectorAll(".admin-nav-btn").forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-panel") === panel);
    });
    document.querySelectorAll(".admin-panel").forEach(function (p) {
      var on = p.id === "panel-" + panel;
      p.classList.toggle("is-active", on);
      p.hidden = !on;
    });
    document.getElementById("adminTitle").textContent = t(TITLE_KEYS[panel]);
    if (panel === "home") renderHome();
    if (panel === "services") setServicesView(servicesView);
    if (panel === "providers") renderProviders();
    if (panel === "users") renderUsers();
    if (panel === "cities") renderCities();
  }

  /* --- Event wiring --- */
  document.querySelectorAll(".lang-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      localStorage.setItem("hands-lang", btn.getAttribute("data-lang"));
      applyI18n();
    });
  });

  document.querySelectorAll(".admin-nav-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      showPanel(btn.getAttribute("data-panel"));
    });
  });

  document.querySelectorAll("[data-services-view]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setServicesView(btn.getAttribute("data-services-view"));
    });
  });

  document.querySelectorAll("[data-job-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      jobFilter = btn.getAttribute("data-job-filter");
      document.querySelectorAll("[data-job-filter]").forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      renderServicesList();
    });
  });

  document.querySelectorAll("[data-chart-range]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      chartRange = btn.getAttribute("data-chart-range") || "7d";
      document.querySelectorAll("[data-chart-range]").forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      renderDashboardChart(B ? B.list() : []);
    });
  });

  document.querySelectorAll("[data-user-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      userFilter = btn.getAttribute("data-user-filter");
      document.querySelectorAll("[data-user-filter]").forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      renderUsers();
    });
  });

  var logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      window.HandsAuth.logout();
      window.location.href = "login.html";
    });
  }

  var calGrid = document.getElementById("calGrid");
  if (calGrid) {
    calGrid.addEventListener("click", function (ev) {
      var cell = ev.target.closest("[data-cal-date]");
      if (!cell) return;
      calSelected = cell.getAttribute("data-cal-date");
      closeAssign();
      renderCalendar();
    });
  }

  var calPrev = document.getElementById("calPrev");
  var calNext = document.getElementById("calNext");
  var calToday = document.getElementById("calToday");
  if (calPrev) {
    calPrev.addEventListener("click", function () {
      calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1);
      renderCalendar();
    });
  }
  if (calNext) {
    calNext.addEventListener("click", function () {
      calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1);
      renderCalendar();
    });
  }
  if (calToday) {
    calToday.addEventListener("click", function () {
      var today = new Date();
      calCursor = today;
      calSelected = B.ymd(today);
      closeAssign();
      renderCalendar();
    });
  }

  document.querySelector(".admin-main").addEventListener("click", function (ev) {
    var evidenceBack = ev.target.closest("#evidenceBackBtn");
    if (evidenceBack) {
      var evidenceView = document.getElementById("evidenceReviewView");
      var listView = document.getElementById("servicesListView");
      if (evidenceView) evidenceView.hidden = true;
      if (listView) listView.hidden = false;
      renderServicesList();
      return;
    }

    var approveButton = ev.target.closest("[data-approve-photo]");
    if (approveButton && B && B.reviewPhoto) {
      var approveResult = B.reviewPhoto(
        approveButton.getAttribute("data-job-id"),
        approveButton.getAttribute("data-approve-photo"),
        "approved",
        ""
      );
      if (approveResult && approveResult.ok) {
        renderEvidenceReview(approveResult.job);
        renderServicesList();
      }
      return;
    }

    var rejectButton = ev.target.closest("[data-reject-photo]");
    if (rejectButton && B && B.reviewPhoto) {
      var note = window.prompt(t("evidenceRejectPrompt"));
      if (note === null) return;
      note = note.trim();
      var rejectResult = B.reviewPhoto(
        rejectButton.getAttribute("data-job-id"),
        rejectButton.getAttribute("data-reject-photo"),
        "rejected",
        note
      );
      if (rejectResult && rejectResult.ok) {
        renderEvidenceReview(rejectResult.job);
        renderServicesList();
      }
      return;
    }

    var saveReportButton = ev.target.closest("[data-save-report-selection]");
    if (saveReportButton && B && B.saveReportSelection) {
      var saveJobId = saveReportButton.getAttribute("data-save-report-selection");
      var selectedInputs = document.querySelectorAll(
        '[data-report-photo][data-job-id="' + saveJobId + '"]:checked'
      );
      var photoIds = Array.prototype.map.call(selectedInputs, function (input) {
        return input.getAttribute("data-report-photo");
      });
      var saveResult = B.saveReportSelection(saveJobId, photoIds);
      if (saveResult && saveResult.ok) {
        renderEvidenceReview(saveResult.job);
      }
      return;
    }

    var publishReportButton = ev.target.closest("[data-publish-report]");
    if (publishReportButton && B && B.publishReport) {
      var publishJobId = publishReportButton.getAttribute("data-publish-report");
      var publishJob = B.get(publishJobId);
      if (!publishJob || !publishJob.report || !Array.isArray(publishJob.report.photos)) {
        return;
      }
      if (!publishJob.report.photos.length) return;
      var publishResult = B.publishReport(publishJobId, publishJob.report.photos);
      if (publishResult && publishResult.ok) {
        renderEvidenceReview(publishResult.job);
      }
      return;
    }

    var reviewButton = ev.target.closest("[data-review-evidence]");
    if (reviewButton && B) {
      var reviewJob = B.get(reviewButton.getAttribute("data-review-evidence"));
      if (!reviewJob) return;
      var listEl = document.getElementById("servicesListView");
      var calEl = document.getElementById("servicesCalView");
      var reviewEl = document.getElementById("evidenceReviewView");
      if (listEl) listEl.hidden = true;
      if (calEl) calEl.hidden = true;
      if (reviewEl) reviewEl.hidden = false;
      renderEvidenceReview(reviewJob);
      return;
    }

    var assignBtn = ev.target.closest("[data-assign-job]");
    if (assignBtn && B) {
      var job = B.get(assignBtn.getAttribute("data-assign-job"));
      if (!job) return;
      showPanel("services");
      calSelected = job.date;
      calCursor = new Date(job.date + "T00:00:00");
      renderCalendar();
      openAssign(job.id);
      return;
    }

    var toggleCity = ev.target.closest("[data-toggle-city]");
    if (toggleCity && window.HandsCities) {
      window.HandsCities.toggle(
        toggleCity.getAttribute("data-toggle-city"),
        toggleCity.getAttribute("data-active") === "1"
      );
      renderCities();
      return;
    }

    var removeCity = ev.target.closest("[data-remove-city]");
    if (removeCity && window.HandsCities) {
      window.HandsCities.remove(removeCity.getAttribute("data-remove-city"));
      renderCities();
    }
  });

  document.querySelector(".admin-main").addEventListener("change", function (ev) {
    var select = ev.target.closest("[data-set-status]");
    if (!select || !B || !B.setStatus) return;
    var next = select.value;
    if (!next) return;
    var result = B.setStatus(select.getAttribute("data-set-status"), next);
    if (!result.ok) {
      window.alert(result.error || t("adminStatusBlocked"));
      select.value = "";
      return;
    }
    persistAndRefresh();
  });

  var assignDate = document.getElementById("assignDate");
  if (assignDate) {
    assignDate.addEventListener("change", function () {
      fillAssignTimes(assignDate.value, document.getElementById("assignTime").value);
    });
  }

  var assignForm = document.getElementById("assignForm");
  if (assignForm) {
    assignForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var id = document.getElementById("assignJobId").value;
      var email = document.getElementById("assignProvider").value;
      var date = document.getElementById("assignDate").value;
      var time = document.getElementById("assignTime").value;
      if (!email) {
        document.getElementById("assignProviderError").textContent = t(
          "adminAssignNeedProvider"
        );
        showMsg("assignMsg", t("valFormFix"), false);
        return;
      }
      document.getElementById("assignProviderError").textContent = "";
      var person = providers().find(function (item) {
        return item.email === email;
      });
      var result = B.assign(id, {
        date: date,
        time: time,
        assigneeEmail: email,
        assigneeName: person ? person.name : email,
      });
      if (!result.ok) {
        showMsg("assignMsg", result.error, false);
        return;
      }
      calSelected = result.job.date;
      calCursor = new Date(result.job.date + "T00:00:00");
      closeAssign();
      persistAndRefresh();
    });
  }

  /* --- Role form --- */
  var roleName = document.getElementById("roleName");
  var roleSlug = document.getElementById("roleSlug");
  var roleDesc = document.getElementById("roleDesc");

  // Auto-suggest slug from name until the operator edits the slug field.
  roleName.addEventListener("input", function () {
    if (!roleSlug.dataset.touched) {
      roleSlug.value = slugify(roleName.value);
      slugBind.refresh();
    }
  });
  roleSlug.addEventListener("input", function () {
    roleSlug.dataset.touched = "1";
    roleSlug.value = slugify(roleSlug.value);
  });

  var roleNameBind = V.bind(roleName, document.getElementById("roleNameError"), function () {
    return V.roleName(roleName.value);
  });
  var slugBind = V.bind(roleSlug, document.getElementById("roleSlugError"), function () {
    var result = V.slug(roleSlug.value);
    if (!result.ok) return result;
    if (slugTaken(roleSlug.value.trim().toLowerCase())) {
      return { ok: false, error: t("valSlugExists") };
    }
    return result;
  });
  var descBind = V.bind(roleDesc, document.getElementById("roleDescError"), function () {
    return V.description(roleDesc.value);
  });
  bindings.push(roleNameBind, slugBind, descBind);

  document.getElementById("roleForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var nameOk = roleNameBind.validate();
    var slugOk = slugBind.validate();
    var descOk = descBind.validate();
    if (!nameOk || !slugOk || !descOk) {
      showMsg("roleMsg", t("valFormFix"), false);
      var invalid = document.getElementById("roleForm").querySelector(".is-invalid");
      if (invalid) invalid.focus();
      return;
    }

    var name = V.compactSpaces(roleName.value);
    var slug = slugify(roleSlug.value || name);
    var description = V.compactSpaces(roleDesc.value);

    serviceRoles.push({ id: slug, name: name, description: description });
    document.getElementById("roleForm").reset();
    delete roleSlug.dataset.touched;
    roleNameBind.reset();
    slugBind.reset();
    descBind.reset();
    showMsg("roleMsg", t("adminRoleCreated"), true);
    persistAndRefresh();
  });

  document.getElementById("serviceRoles").addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-remove-role]");
    if (!btn) return;
    var id = btn.getAttribute("data-remove-role");
    serviceRoles = serviceRoles.filter(function (r) {
      return r.id !== id;
    });
    users = users.map(function (u) {
      return {
        name: u.name,
        email: u.email,
        access: u.access,
        services: (u.services || []).filter(function (s) {
          return s !== id;
        }),
      };
    });
    persistAndRefresh();
  });

  /* --- User form --- */
  var userName = document.getElementById("userName");
  var userEmail = document.getElementById("userEmail");
  var userPassword = document.getElementById("userPassword");
  var userConfirm = document.getElementById("userConfirm");
  var userAccess = document.getElementById("userAccess");
  var userServicesError = document.getElementById("userServicesError");

  function selectedServices() {
    var services = [];
    document.querySelectorAll('input[name="serviceRole"]:checked').forEach(function (el) {
      services.push(el.value);
    });
    return services;
  }

  function validateServices() {
    var access = userAccess.value;
    var services = selectedServices();
    if (access === "provider" && !services.length) {
      userServicesError.textContent = t("valProviderServices");
      return false;
    }
    userServicesError.textContent = "";
    return true;
  }

  var userNameBind = V.bind(userName, document.getElementById("userNameError"), function () {
    return V.personName(userName.value);
  });
  var userEmailBind = V.bind(userEmail, document.getElementById("userEmailError"), function () {
    var result = V.email(userEmail.value);
    if (!result.ok) return result;
    if (emailTaken(userEmail.value)) {
      return { ok: false, error: t("valEmailExists") };
    }
    return result;
  });
  var userPassBind = V.bind(userPassword, document.getElementById("userPasswordError"), function () {
    return V.password(userPassword.value, {
      name: userName.value,
      email: userEmail.value,
      minLength: 12,
    });
  });
  var userConfirmBind = V.bind(
    userConfirm,
    document.getElementById("userConfirmError"),
    function () {
      return V.confirm(userPassword.value, userConfirm.value);
    }
  );
  var userAccessBind = V.bind(userAccess, document.getElementById("userAccessError"), function () {
    return V.access(userAccess.value);
  });
  bindings.push(userNameBind, userEmailBind, userPassBind, userConfirmBind, userAccessBind);

  userName.addEventListener("input", function () {
    if (userPassword.value) userPassBind.refresh();
  });
  userEmail.addEventListener("input", function () {
    if (userPassword.value) userPassBind.refresh();
  });
  userPassword.addEventListener("input", function () {
    if (userConfirm.value) userConfirmBind.refresh();
  });
  userAccess.addEventListener("change", validateServices);
  document.getElementById("serviceRoleChecks").addEventListener("change", validateServices);

  document.getElementById("userForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var nameOk = userNameBind.validate();
    var emailOk = userEmailBind.validate();
    var passOk = userPassBind.validate();
    var confirmOk = userConfirmBind.validate();
    var accessOk = userAccessBind.validate();
    var servicesOk = validateServices();

    if (!nameOk || !emailOk || !passOk || !confirmOk || !accessOk || !servicesOk) {
      showMsg("userMsg", t("valFormFix"), false);
      var invalid = document.getElementById("userForm").querySelector(".is-invalid");
      if (invalid) invalid.focus();
      return;
    }

    window.HandsAuth.createAccount({
      name: userName.value,
      email: userEmail.value,
      password: userPassword.value,
      confirm: userConfirm.value,
      access: userAccess.value,
      services: selectedServices(),
      minLength: 12,
    }).then(function (created) {
      if (!created.ok) {
        showMsg("userMsg", created.message || t("valFormFix"), false);
        return;
      }

      users.push({
        name: created.user.name,
        email: created.user.email,
        access: created.user.access,
        services: created.user.services,
      });
      document.getElementById("userForm").reset();
      userNameBind.reset();
      userEmailBind.reset();
      userPassBind.reset();
      userConfirmBind.reset();
      userAccessBind.reset();
      userServicesError.textContent = "";
      showMsg("userMsg", t("adminUserCreated"), true);
      persistAndRefresh();
    });
  });

  /* --- City form --- */
  var cityForm = document.getElementById("cityForm");
  var cityName = document.getElementById("cityName");
  if (cityForm && cityName && window.HandsCities) {
    cityForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var err = document.getElementById("cityNameError");
      var label = String(cityName.value || "").trim();
      if (label.length < 2) {
        err.textContent = t("adminCityNameShort");
        cityName.classList.add("is-invalid");
        showMsg("cityMsg", t("valFormFix"), false);
        return;
      }
      err.textContent = "";
      cityName.classList.remove("is-invalid");
      var result = window.HandsCities.add(label);
      if (!result.ok) {
        err.textContent =
          result.error === "exists" ? t("adminCityExists") : t("adminCityNameShort");
        showMsg("cityMsg", t("valFormFix"), false);
        return;
      }
      cityForm.reset();
      showMsg("cityMsg", t("adminCityCreated"), true);
      renderCities();
    });
  }

  applyI18n();
  showPanel("home");
})();
