/**
 * HandsVisits — anonymous public-site visit counter for the admin dashboard.
 *
 * Counts once per browser tab session (sessionStorage gate) so refreshes do not
 * inflate totals. Day buckets support the dashboard sparkline / last-N chart.
 */
window.HandsVisits = (function () {
  var TOTAL_KEY = "hands-visits-total";
  var DAYS_KEY = "hands-visits-days";
  var SESSION_KEY = "hands-visit-session";

  function readTotal() {
    var n = Number(localStorage.getItem(TOTAL_KEY) || 0);
    return isNaN(n) ? 0 : n;
  }

  function readDays() {
    try {
      return JSON.parse(localStorage.getItem(DAYS_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function todayKey() {
    var d = new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return (
      d.getFullYear() +
      "-" +
      (m < 10 ? "0" + m : m) +
      "-" +
      (day < 10 ? "0" + day : day)
    );
  }

  /** Increment totals only on the first track() call in this tab session. */
  function track() {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return readTotal();
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch (e) {}
    var total = readTotal() + 1;
    localStorage.setItem(TOTAL_KEY, String(total));
    var days = readDays();
    var key = todayKey();
    days[key] = (days[key] || 0) + 1;
    localStorage.setItem(DAYS_KEY, JSON.stringify(days));
    return total;
  }

  /** Chronological series of the last n calendar days (zeros for missing days). */
  function lastDays(n) {
    var days = readDays();
    var out = [];
    var now = new Date();
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      var m = d.getMonth() + 1;
      var day = d.getDate();
      var key =
        d.getFullYear() +
        "-" +
        (m < 10 ? "0" + m : m) +
        "-" +
        (day < 10 ? "0" + day : day);
      out.push({ date: key, count: days[key] || 0 });
    }
    return out;
  }

  return {
    track: track,
    total: readTotal,
    lastDays: lastDays,
    today: function () {
      return readDays()[todayKey()] || 0;
    },
  };
})();
