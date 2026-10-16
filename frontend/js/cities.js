/**
 * HandsCities — coverage catalog for the service builder and admin CRUD.
 *
 * Cities come from the API (GET /catalog/cities). They are cached in memory for the
 * lifetime of the page only: localStorage is deliberately not used, because a stale
 * copy there would keep showing cities that are no longer offered.
 *
 * list(false) returns active cities (builder coverage); list(true) also returns
 * inactive ones, which the admin panel shows as "not offered yet".
 *
 * If the API cannot be reached, the last known list is used so the builder still
 * renders, and callers can detect the degraded state through ready()/isLive().
 */
window.HandsCities = (function () {
  /* Coverage confirmed at launch. Used only when the API is unreachable. */
  var FALLBACK = [
    { id: "bogota", name: "Bogotá", active: true },
    { id: "girardot", name: "Girardot", active: true },
    { id: "tunja", name: "Tunja", active: true },
    { id: "zipaquira", name: "Zipaquirá", active: true },
  ];

  var cache = null;
  var live = false;
  var pending = null;

  /** Stable id from display name; diacritics stripped for URL-safe keys. */
  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }

  /** Removes the legacy localStorage copy so old visitors stop seeing stale cities. */
  function clearLegacyStorage() {
    try {
      localStorage.removeItem("hands-cities");
    } catch (e) {
      /* Storage may be unavailable (private mode); nothing to clean. */
    }
  }

  function normalise(raw) {
    return (raw || [])
      .filter(function (c) {
        return c && (c.slug || c.id);
      })
      .map(function (c) {
        return {
          id: c.slug || c.id,
          name: c.name || c.slug || c.id,
          active: c.active !== false,
        };
      });
  }

  /**
   * Loads the catalog once per page. Subsequent calls reuse the same promise, so
   * several widgets on one page cause a single request.
   * @returns {Promise<Array>}
   */
  function ready() {
    if (pending) return pending;
    if (!window.HandsApi || !window.HandsApi.catalog) {
      cache = FALLBACK.slice();
      return Promise.resolve(cache);
    }
    pending = window.HandsApi.catalog
      .cities()
      .then(function (rows) {
        var list = normalise(rows);
        cache = list.length ? list : FALLBACK.slice();
        live = list.length > 0;
        return cache;
      })
      .catch(function () {
        cache = FALLBACK.slice();
        return cache;
      });
    return pending;
  }

  function current() {
    return cache || FALLBACK.slice();
  }

  /** True when the list came from the API rather than the built-in fallback. */
  function isLive() {
    return live;
  }

  /**
   * @param {boolean} [all] when true, include cities that are not offered yet.
   */
  function list(all) {
    var items = current();
    if (all) return items.slice();
    return items.filter(function (c) {
      return c.active !== false;
    });
  }

  function nameById(id) {
    var found = current().find(function (c) {
      return c.id === id;
    });
    return found ? found.name : id || "—";
  }

  function isActive(id) {
    return current().some(function (c) {
      return c.id === id && c.active !== false;
    });
  }

  /**
   * Admin-only mutations. The catalog is server-owned, so these are not persisted
   * locally; the admin panel will call the API once that endpoint exists.
   */
  function add(name) {
    var label = String(name || "").trim();
    if (label.length < 2) return { ok: false, error: "short" };
    var id = slugify(label);
    if (!id) return { ok: false, error: "slug" };
    if (current().some(function (c) { return c.id === id; })) {
      return { ok: false, error: "exists" };
    }
    return { ok: false, error: "readonly" };
  }

  function toggle() {
    return false;
  }

  function remove() {
    return false;
  }

  function count() {
    return list(false).length;
  }

  clearLegacyStorage();

  return {
    ready: ready,
    isLive: isLive,
    list: list,
    nameById: nameById,
    isActive: isActive,
    add: add,
    toggle: toggle,
    remove: remove,
    count: count,
    slugify: slugify,
  };
})();
