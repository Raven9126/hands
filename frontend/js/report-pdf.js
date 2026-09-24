/**
 * HandsReportPdf — client-side service report for print / Save as PDF.
 *
 * No backend: opens a branded HTML sheet and triggers the browser print dialog
 * (user can choose “Save as PDF”). Only published report photos are included.
 */
window.HandsReportPdf = (function () {
  function dict() {
    return (window.HandsI18n && window.HandsI18n.dict()) || {};
  }

  function t(key, fallback) {
    return dict()[key] || fallback || key;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

  function starsText(score) {
    if (!(typeof score === "number" && score >= 1)) return "—";
    var out = "";
    var i;
    for (i = 1; i <= 5; i++) out += i <= score ? "★" : "☆";
    return out + " (" + score + "/5)";
  }

  function groupPhotos(photos) {
    var spaces = {};
    var order = [];
    photos.forEach(function (photo) {
      var space = photo.space || "other";
      if (!spaces[space]) {
        spaces[space] = [];
        order.push(space);
      }
      spaces[space].push(photo);
    });
    return { spaces: spaces, order: order };
  }

  function buildHtml(job) {
    var B = window.HandsBookings;
    if (!B || !job) return "";

    var photos = B.publishedPhotos(job);
    var grouped = groupPhotos(photos);
    var when = B.formatWhen(job.date, job.time);
    var city = B.cityName(job.city);
    var place = B.formatPlace(job);
    var size = B.sizeLabel(job.size);
    var intensity = B.intensityLabel(job.intensity);
    var staff = job.assigneeName || t("adminUnassigned", "Sin asignar");
    var ratingLine = starsText(job.rating);
    if (job.ratingComment) ratingLine += " — " + job.ratingComment;

    var photoHtml = "";
    if (!photos.length) {
      photoHtml =
        "<p class=\"muted\">" +
        escapeHtml(t("bookingDetailEvidenceEmpty", "Sin fotografías en el informe.")) +
        "</p>";
    } else {
      grouped.order.forEach(function (space) {
        photoHtml += "<section class=\"space\"><h2>" + escapeHtml(spaceLabel(space)) + "</h2><div class=\"pair\">";
        grouped.spaces[space].forEach(function (photo) {
          photoHtml +=
            "<figure>" +
            "<img src=\"" +
            escapeHtml(photo.url) +
            "\" alt=\"\" />" +
            "<figcaption>" +
            escapeHtml(typeLabel(photo.type)) +
            "</figcaption>" +
            "</figure>";
        });
        photoHtml += "</div></section>";
      });
    }

    var title = t("reportPdfTitle", "Informe de servicio Hands");
    var generated = t("reportPdfGenerated", "Generado") + ": " + new Date().toLocaleString();

    return (
      "<!DOCTYPE html><html lang=\"" +
      escapeHtml((window.HandsI18n && window.HandsI18n.lang()) || "es") +
      "\"><head><meta charset=\"UTF-8\" />" +
      "<title>" +
      escapeHtml(title) +
      "</title>" +
      "<style>" +
      "*{box-sizing:border-box}body{margin:0;font-family:Segoe UI,Arial,sans-serif;color:#36454F;background:#fff}" +
      ".sheet{max-width:880px;margin:0 auto;padding:28px 24px 40px}" +
      ".brand{display:flex;align-items:center;justify-content:space-between;gap:1rem;border-bottom:2px solid #1f5c44;padding-bottom:14px;margin-bottom:22px}" +
      ".brand img{width:72px;height:72px;object-fit:contain}" +
      "h1{margin:0;font-size:1.55rem;color:#1f5c44}" +
      ".meta{margin:0.35rem 0 0;font-size:0.85rem;color:#5c6b73}" +
      "dl{display:grid;grid-template-columns:140px 1fr;gap:0.45rem 0.85rem;margin:0 0 1.4rem}" +
      "dt{font-size:0.78rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#5c6b73}" +
      "dd{margin:0;font-weight:600}" +
      "h2{margin:1.2rem 0 0.65rem;font-size:1.05rem;color:#1f5c44}" +
      ".pair{display:grid;grid-template-columns:1fr 1fr;gap:0.75rem}" +
      "figure{margin:0}figure img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;border:1px solid #d7ebe3}" +
      "figcaption{margin-top:0.3rem;font-size:0.75rem;font-weight:650;letter-spacing:0.08em;text-transform:uppercase;color:#5c6b73}" +
      ".muted{color:#5c6b73}" +
      ".foot{margin-top:2rem;padding-top:0.85rem;border-top:1px solid #d7ebe3;font-size:0.8rem;color:#5c6b73}" +
      "@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{padding:0}" +
      "@page{margin:14mm}}" +
      "@media (max-width:640px){.pair{grid-template-columns:1fr}dl{grid-template-columns:1fr}}" +
      "</style></head><body><div class=\"sheet\">" +
      "<header class=\"brand\">" +
      "<div><h1>" +
      escapeHtml(title) +
      "</h1><p class=\"meta\">" +
      escapeHtml(generated) +
      "</p></div>" +
      "<img src=\"img/brand/hands-logo.png\" alt=\"Hands\" width=\"72\" height=\"72\" />" +
      "</header>" +
      "<dl>" +
      "<dt>" +
      escapeHtml(t("bookingDetailDateLabel", "Fecha y hora")) +
      "</dt><dd>" +
      escapeHtml(when) +
      "</dd>" +
      "<dt>" +
      escapeHtml(t("bookingDetailCityLabel", "Ciudad")) +
      "</dt><dd>" +
      escapeHtml(city) +
      "</dd>" +
      "<dt>" +
      escapeHtml(t("bookingDetailPlaceLabel", "Dirección")) +
      "</dt><dd>" +
      escapeHtml(place) +
      "</dd>" +
      "<dt>" +
      escapeHtml(t("bookingDetailTypeLabel", "Tamaño")) +
      "</dt><dd>" +
      escapeHtml(size) +
      "</dd>" +
      "<dt>" +
      escapeHtml(t("bookingDetailIntensityLabel", "Nivel de aseo")) +
      "</dt><dd>" +
      escapeHtml(intensity) +
      "</dd>" +
      "<dt>" +
      escapeHtml(t("bookingDetailTotalLabel", "Total")) +
      "</dt><dd>" +
      escapeHtml(formatCop(job.total)) +
      "</dd>" +
      "<dt>" +
      escapeHtml(t("bookingDetailStaffAssigned", "Personal asignado")) +
      "</dt><dd>" +
      escapeHtml(staff) +
      "</dd>" +
      "<dt>" +
      escapeHtml(t("bookingDetailRatingLabel", "Calificación")) +
      "</dt><dd>" +
      escapeHtml(ratingLine) +
      "</dd>" +
      "</dl>" +
      "<h2>" +
      escapeHtml(t("bookingDetailPhotos", "Fotos del servicio")) +
      "</h2>" +
      photoHtml +
      "<p class=\"foot\">" +
      escapeHtml(t("reportPdfFooter", "Hands — Limpieza profesional para alojamientos. Informe de evidencia del servicio.")) +
      "</p>" +
      "</div>" +
      "<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},250);});<\/script>" +
      "</body></html>"
    );
  }

  /**
   * Opens the report sheet and triggers print (Save as PDF).
   * Requires job.report.published and at least the published photo set to be meaningful.
   */
  function open(job) {
    if (!job || !job.report || !job.report.published) {
      return {
        ok: false,
        error: t(
          "bookingDetailPdfBlocked",
          "El PDF estará disponible cuando el informe esté publicado."
        ),
      };
    }

    var html = buildHtml(job);
    var win = window.open("", "_blank");
    if (!win) {
      return {
        ok: false,
        error: t(
          "bookingDetailPdfPopup",
          "Permite ventanas emergentes para generar el informe PDF."
        ),
      };
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    return { ok: true };
  }

  return { open: open };
})();
