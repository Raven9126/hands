/**
 * Service detail page — reads ?type= and fills the detail shell from a catalog.
 * Types: turnover | deep | areas | linen
 */
(function () {
  var CATALOG = {
    turnover: {
      titleKey: "svc1Title",
      leadKey: "svcDetailTurnoverLead",
      descKey: "svcDetailTurnoverDesc",
      howKey: "svcDetailTurnoverHow",
      image: "img/photos/living.jpg",
      before: "img/photos/bedroom-before.jpg",
      after: "img/photos/bedroom-after.jpg",
      included: ["svcIncFloor", "svcIncKitchen", "svcIncBath", "svcIncBedsOpt", "svcIncProof"],
      excluded: ["svcExcDeep", "svcExcRepairs", "svcExcWindows"],
      extras: ["svcExtraLinen", "svcExtraRestock", "svcExtraKit"],
      faq: [
        { q: "svcFaqDurationQ", a: "svcFaqDurationA" },
        { q: "svcFaqAccessQ", a: "svcFaqAccessA" },
        { q: "svcFaqProofQ", a: "svcFaqProofA" },
      ],
    },
    deep: {
      titleKey: "svc2Title",
      leadKey: "svcDetailDeepLead",
      descKey: "svcDetailDeepDesc",
      howKey: "svcDetailDeepHow",
      image: "img/photos/office.jpg",
      before: "img/photos/kitchen-before.jpg",
      after: "img/photos/kitchen-after.jpg",
      included: ["svcIncFloor", "svcIncKitchen", "svcIncBath", "svcIncDetail", "svcIncProof"],
      excluded: ["svcExcRepairs", "svcExcWindows", "svcExcLaundry"],
      extras: ["svcExtraLinen", "svcExtraRestock", "svcExtraKit"],
      faq: [
        { q: "svcFaqDeepQ", a: "svcFaqDeepA" },
        { q: "svcFaqAccessQ", a: "svcFaqAccessA" },
        { q: "svcFaqProofQ", a: "svcFaqProofA" },
      ],
    },
    areas: {
      titleKey: "svc3Title",
      leadKey: "svcDetailAreasLead",
      descKey: "svcDetailAreasDesc",
      howKey: "svcDetailAreasHow",
      image: "img/photos/kitchen.jpg",
      before: "img/photos/bathroom-before.jpg",
      after: "img/photos/bathroom-after.jpg",
      included: ["svcIncFocus", "svcIncSurfaces", "svcIncProof"],
      excluded: ["svcExcFullHome", "svcExcRepairs"],
      extras: ["svcExtraLinen", "svcExtraRestock"],
      faq: [
        { q: "svcFaqAreasQ", a: "svcFaqAreasA" },
        { q: "svcFaqAccessQ", a: "svcFaqAccessA" },
        { q: "svcFaqProofQ", a: "svcFaqProofA" },
      ],
    },
    linen: {
      titleKey: "svc4Title",
      leadKey: "svcDetailLinenLead",
      descKey: "svcDetailLinenDesc",
      howKey: "svcDetailLinenHow",
      image: "img/photos/boxes.jpg",
      before: "img/photos/bedroom-before.jpg",
      after: "img/photos/bedroom-after.jpg",
      included: ["svcIncSheets", "svcIncTowels", "svcIncRestockBasic", "svcIncProof"],
      excluded: ["svcExcLaundry", "svcExcFullHome"],
      extras: ["svcExtraKit", "svcExtraAreas"],
      faq: [
        { q: "svcFaqLinenQ", a: "svcFaqLinenA" },
        { q: "svcFaqAccessQ", a: "svcFaqAccessA" },
        { q: "svcFaqProofQ", a: "svcFaqProofA" },
      ],
    },
  };

  function dict() {
    var i18n = window.HandsI18n;
    if (!i18n) return {};
    var lang = localStorage.getItem("hands-lang") || "es";
    return i18n[lang] || i18n.es || {};
  }

  function t(key) {
    var d = dict();
    return d[key] || key;
  }

  function fillList(el, keys) {
    if (!el) return;
    el.innerHTML = keys
      .map(function (key) {
        return "<li>" + t(key) + "</li>";
      })
      .join("");
  }

  function fillFaq(el, items) {
    if (!el) return;
    el.innerHTML = items
      .map(function (item) {
        return (
          '<details class="faq-item">' +
          "<summary>" +
          t(item.q) +
          "</summary>" +
          "<p>" +
          t(item.a) +
          "</p>" +
          "</details>"
        );
      })
      .join("");
  }

  function typeFromQuery() {
    var params = new URLSearchParams(window.location.search);
    var type = (params.get("type") || "turnover").toLowerCase();
    return CATALOG[type] ? type : "turnover";
  }

  function render() {
    var type = typeFromQuery();
    var entry = CATALOG[type];
    var titleEl = document.getElementById("serviceTitle");
    var leadEl = document.getElementById("serviceLead");
    var descEl = document.getElementById("serviceDesc");
    var howEl = document.getElementById("serviceHow");
    var hero = document.getElementById("serviceHeroImg");
    var before = document.getElementById("serviceBaBefore");
    var after = document.getElementById("serviceBaAfter");
    var buildLink = document.getElementById("serviceBuildLink");

    if (titleEl) titleEl.textContent = t(entry.titleKey);
    if (leadEl) leadEl.textContent = t(entry.leadKey);
    if (descEl) descEl.textContent = t(entry.descKey);
    if (howEl) howEl.textContent = t(entry.howKey);
    if (hero) hero.src = entry.image;
    if (before) before.src = entry.before;
    if (after) after.src = entry.after;
    if (buildLink) buildLink.href = "build.html?type=" + type;

    fillList(document.getElementById("serviceIncluded"), entry.included);
    fillList(document.getElementById("serviceExcluded"), entry.excluded);
    fillList(document.getElementById("serviceExtras"), entry.extras);
    fillFaq(document.getElementById("serviceFaq"), entry.faq);

    document.title = "Hands — " + t(entry.titleKey);
  }

  window.render = render;
  window.HandsServiceDetail = { render: render };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }

  window.addEventListener("hands:langchange", render);
})();
