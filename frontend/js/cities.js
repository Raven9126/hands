/**
 * HandsCities — coverage catalog for the service builder and admin CRUD.
 *
 * Persists to localStorage so activated cities stay available across sessions.
 * list(false) returns only active cities (builder coverage); list(true) returns all.
 */
window.HandsCities = (function () {
  var KEY = "hands-cities";
  var DEFAULTS = [
    { id: "bogota", name: "Bogotá", active: true },
    { id: "cajica", name: "Cajicá", active: true },
    { id: "chia", name: "Chía", active: true },
    { id: "medellin", name: "Medellín", active: true },
    { id: "tunja", name: "Tunja", active: true },
    { id: "zipaquira", name: "Zipaquirá", active: true },
  ];

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

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) {
        localStorage.setItem(KEY, JSON.stringify(DEFAULTS));
        return DEFAULTS.slice();
      }
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length ? parsed : DEFAULTS.slice();
    } catch (e) {
      return DEFAULTS.slice();
    }
  }

  function write(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  /**
   * @param {boolean} [all] when true, include inactive cities for admin.
   */
  function list(all) {
    var items = read();
    if (all) return items.slice();
    return items.filter(function (c) {
      return c.active !== false;
    });
  }

  function nameById(id) {
    var found = read().find(function (c) {
      return c.id === id;
    });
    return found ? found.name : id || "—";
  }

  function add(name) {
    var label = String(name || "").trim();
    if (label.length < 2) return { ok: false, error: "short" };
    var id = slugify(label);
    if (!id) return { ok: false, error: "slug" };
    var items = read();
    if (
      items.some(function (c) {
        return c.id === id;
      })
    ) {
      return { ok: false, error: "exists" };
    }
    items.push({ id: id, name: label, active: true });
    write(items);
    return { ok: true, city: items[items.length - 1] };
  }

  function toggle(id, active) {
    var items = read().map(function (c) {
      if (c.id !== id) return c;
      return { id: c.id, name: c.name, active: !!active };
    });
    write(items);
    return true;
  }

  function remove(id) {
    write(
      read().filter(function (c) {
        return c.id !== id;
      })
    );
    return true;
  }

  function count() {
    return list(false).length;
  }

  return {
    list: list,
    nameById: nameById,
    add: add,
    toggle: toggle,
    remove: remove,
    count: count,
    slugify: slugify,
  };
})();
