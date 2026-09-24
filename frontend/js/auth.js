/**
 * HandsAuth — local account store, session, registration, and login.
 *
 * Passwords are stored as PBKDF2-SHA-256 digests (never plaintext). A production
 * API should use Argon2id or bcrypt on the server instead of client-side hashing.
 * Session payloads omit the password hash. Demo accounts are seeded on first load.
 */
window.HandsAuth = (function () {
  /* --- Storage keys & crypto constants --- */
  var ACCOUNTS_KEY = "hands-accounts";
  var SESSION_KEY = "hands-session";
  var DEMO_PASSWORD = "Hands@2026Co!";
  var HASH_PREFIX = "pbkdf2$v1$";
  var PBKDF2_ITERATIONS = 120000;
  var readyPromise = null;

  var DEMO = [
    {
      name: "Laura Host",
      email: "host@hands.co",
      access: "host",
      services: [],
      property: {
        address: "Cra 7 # 32-16",
        unit: "Apto 801",
        neighborhood: "Chapinero",
        phone: "3001234567",
        inComplex: true,
        complexName: "Residencias Chapinero",
        complexTower: "Torre A",
        complexApt: "801",
        needsAuth: true,
        accessNotes: "Portería. Dejar llaves en recepción.",
      },
    },
    {
      name: "Ana Admin",
      email: "admin@hands.co",
      access: "admin",
      services: [],
    },
    {
      name: "Carlos Méndez",
      email: "carlos@hands.co",
      access: "provider",
      services: ["cleaner"],
    },
  ];

  /* --- Password hashing (Web Crypto PBKDF2) --- */
  function toBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = "";
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function fromBase64(value) {
    var binary = atob(value);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function isHashed(value) {
    return String(value || "").indexOf(HASH_PREFIX) === 0;
  }

  /** Constant-time string compare to limit timing leaks on digest checks. */
  function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  function deriveBits(plain, saltBytes, iterations) {
    return crypto.subtle
      .importKey("raw", new TextEncoder().encode(plain), "PBKDF2", false, ["deriveBits"])
      .then(function (key) {
        return crypto.subtle.deriveBits(
          {
            name: "PBKDF2",
            salt: saltBytes,
            iterations: iterations,
            hash: "SHA-256",
          },
          key,
          256
        );
      });
  }

  function hashPassword(plain) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    return deriveBits(plain, salt, PBKDF2_ITERATIONS).then(function (bits) {
      return (
        HASH_PREFIX +
        PBKDF2_ITERATIONS +
        "$" +
        toBase64(salt) +
        "$" +
        toBase64(bits)
      );
    });
  }

  function verifyPassword(plain, stored) {
    // Legacy plaintext rows (pre-migration) compare directly; hashed rows re-derive.
    if (!isHashed(stored)) {
      return Promise.resolve(plain === stored);
    }
    var parts = String(stored).split("$");
    if (parts.length !== 5) return Promise.resolve(false);
    var iterations = Number(parts[2]);
    var salt = fromBase64(parts[3]);
    var expected = parts[4];
    return deriveBits(plain, salt, iterations).then(function (bits) {
      return timingSafeEqual(toBase64(bits), expected);
    });
  }

  /* --- Account persistence --- */
  function writeAccounts(list) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
  }

  function readRawAccounts() {
    try {
      var raw = localStorage.getItem(ACCOUNTS_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  /** Ensures demo users exist and every stored password is hashed. */
  function ensureReady() {
    if (readyPromise) return readyPromise;

    readyPromise = (async function () {
      var accounts = readRawAccounts();
      var byEmail = {};
      accounts.forEach(function (account) {
        byEmail[account.email] = account;
      });

      for (var i = 0; i < DEMO.length; i++) {
        var demo = DEMO[i];
        var current = byEmail[demo.email];
        if (!current) {
          byEmail[demo.email] = {
            name: demo.name,
            email: demo.email,
            password: await hashPassword(DEMO_PASSWORD),
            access: demo.access,
            services: demo.services.slice(),
            property: demo.property ? normalizeProperty(demo.property) : normalizeProperty(null),
          };
          continue;
        }

        var needsHash =
          !isHashed(current.password) ||
          current.password === "hands123" ||
          current.password === "Hands@2026Co";
        var nextAccount = {
          name: current.name || demo.name,
          email: demo.email,
          password: needsHash ? await hashPassword(DEMO_PASSWORD) : current.password,
          access: current.access || demo.access,
          services: current.services || demo.services.slice(),
          property: normalizeProperty(current.property || demo.property),
        };
        // Seed demo host property once if the account never saved an address.
        if (
          demo.email === "host@hands.co" &&
          demo.property &&
          !(current.property && current.property.address)
        ) {
          nextAccount.property = normalizeProperty(demo.property);
        }
        byEmail[demo.email] = nextAccount;
      }

      var next = Object.keys(byEmail).map(function (email) {
        return byEmail[email];
      });

      for (var j = 0; j < next.length; j++) {
        if (!isHashed(next[j].password)) {
          // Non-demo legacy plaintext accounts cannot be recovered; force re-hash only if
          // the value still looks like a password the user typed (migrate in place).
          next[j].password = await hashPassword(next[j].password);
        }
      }

      writeAccounts(next);
      return next;
    })();

    return readyPromise;
  }

  function readAccounts() {
    return readRawAccounts();
  }

  /* --- Session --- */
  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /** Persist a password-free session snapshot used by gated pages. */
  function setSession(user) {
    var session = {
      name: user.name,
      email: user.email,
      access: user.access,
      services: user.services || [],
      property: normalizeProperty(user.property),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function findByEmail(email) {
    var needle = String(email || "").trim().toLowerCase();
    return readAccounts().find(function (a) {
      return a.email === needle;
    });
  }

  /** Normalize host property / complex-access payload stored on the account. */
  function normalizeProperty(raw) {
    var V = window.HandsValidate;
    var compact = V
      ? V.compactSpaces
      : function (v) {
          return String(v || "").trim().replace(/\s+/g, " ");
        };
    var src = raw && typeof raw === "object" ? raw : {};
    var inComplex = !!src.inComplex;
    return {
      address: compact(src.address || ""),
      unit: compact(src.unit || ""),
      neighborhood: compact(src.neighborhood || ""),
      phone: String(src.phone || "").trim(),
      inComplex: inComplex,
      complexName: inComplex ? compact(src.complexName || "") : "",
      complexTower: inComplex ? compact(src.complexTower || "") : "",
      complexApt: inComplex ? compact(src.complexApt || "") : "",
      needsAuth: inComplex ? !!src.needsAuth : false,
      accessNotes: compact(src.accessNotes || ""),
    };
  }

  /**
   * Validate property fields for host self-registration.
   * Complex access details are required only when inComplex is true.
   */
  function validateProperty(raw) {
    var V = window.HandsValidate;
    if (!V) return { ok: false, field: "address", message: "Validation unavailable" };
    if (!raw || typeof raw !== "object" || typeof raw.inComplex !== "boolean") {
      return { ok: false, field: "complex", message: V.t("valComplexRequired") };
    }
    var property = normalizeProperty(raw);
    var addressCheck = V.address(property.address);
    if (!addressCheck.ok) return { ok: false, field: "address", message: addressCheck.error };
    var unitCheck = V.unit(property.unit);
    if (!unitCheck.ok) return { ok: false, field: "unit", message: unitCheck.error };
    var neighborhoodCheck = V.neighborhood(property.neighborhood);
    if (!neighborhoodCheck.ok) {
      return { ok: false, field: "neighborhood", message: neighborhoodCheck.error };
    }
    var phoneCheck = V.phone(property.phone);
    if (!phoneCheck.ok) return { ok: false, field: "phone", message: phoneCheck.error };
    var accessCheck = V.accessNotes(property.accessNotes);
    if (!accessCheck.ok) return { ok: false, field: "access", message: accessCheck.error };

    if (property.inComplex) {
      if (!property.complexName || property.complexName.length < 2) {
        return { ok: false, field: "complexName", message: V.t("valComplexNameRequired") };
      }
      if (property.complexName.length > 80) {
        return { ok: false, field: "complexName", message: V.t("valNameLong") };
      }
      var towerCheck = V.unit(property.complexTower);
      if (!towerCheck.ok) return { ok: false, field: "complexTower", message: towerCheck.error };
      if (!property.complexApt) {
        return { ok: false, field: "complexApt", message: V.t("valComplexAptRequired") };
      }
      var aptCheck = V.unit(property.complexApt);
      if (!aptCheck.ok) return { ok: false, field: "complexApt", message: aptCheck.error };
      if (typeof raw.needsAuth !== "boolean") {
        return { ok: false, field: "needsAuth", message: V.t("valNeedsAuthRequired") };
      }
    }

    return { ok: true, property: property };
  }

  /** Map stored property into wizard place fields (address / unit / access). */
  function propertyToPlace(property) {
    var p = normalizeProperty(property);
    if (!p.address && !p.phone) return null;
    var unit = p.unit;
    if (p.inComplex) {
      var parts = [];
      if (p.complexTower) parts.push(p.complexTower);
      if (p.complexApt) {
        parts.push(/apto|apt|ap\.?/i.test(p.complexApt) ? p.complexApt : "apto " + p.complexApt);
      }
      if (parts.length) unit = parts.join(", ");
    }
    var accessParts = [];
    if (p.inComplex && p.complexName) accessParts.push("Conjunto: " + p.complexName);
    if (p.inComplex && p.needsAuth) accessParts.push("Requiere autorización en portería");
    if (p.accessNotes) accessParts.push(p.accessNotes);
    return {
      address: p.address,
      unit: unit,
      neighborhood: p.neighborhood,
      phone: p.phone,
      access: accessParts.join(". "),
    };
  }

  /* --- Registration & login --- */
  function buildUser(payload) {
    var V = window.HandsValidate;
    var name = V.compactSpaces(payload.name);
    var email = String(payload.email || "").trim().toLowerCase();
    var password = String(payload.password || "");
    var confirmValue = String(payload.confirm || "");
    var access = payload.access || "host";
    var services = payload.services || [];

    var nameCheck = V.personName(name);
    if (!nameCheck.ok) return { ok: false, field: "name", message: nameCheck.error };
    var emailCheck = V.email(email);
    if (!emailCheck.ok) return { ok: false, field: "email", message: emailCheck.error };
    var passCheck = V.password(password, {
      name: name,
      email: email,
      phone: payload.phone || (payload.property && payload.property.phone),
      minLength: Number(payload.minLength) > 0 ? Number(payload.minLength) : 8,
    });
    if (!passCheck.ok) return { ok: false, field: "password", message: passCheck.error };
    var confirmCheck = V.confirm(password, confirmValue);
    if (!confirmCheck.ok) return { ok: false, field: "confirm", message: confirmCheck.error };
    var accessCheck = V.access(access);
    if (!accessCheck.ok) return { ok: false, field: "access", message: accessCheck.error };
    if (access === "provider" && (!services || !services.length)) {
      return { ok: false, field: "services", message: V.t("valProviderServices") };
    }
    if (findByEmail(email)) {
      return { ok: false, field: "email", message: V.t("valEmailExists") };
    }

    return {
      ok: true,
      plainPassword: password,
      user: {
        name: name,
        email: email,
        access: access,
        services: access === "provider" ? services : [],
      },
    };
  }

  function saveUser(user) {
    var accounts = readAccounts();
    accounts.push(user);
    writeAccounts(accounts);
    return user;
  }

  /** Public signup — always creates a host session after hashing. */
  function register(payload) {
    return ensureReady().then(function () {
      var built = buildUser({
        name: payload.name,
        email: payload.email,
        password: payload.password,
        confirm: payload.confirm,
        access: "host",
        services: [],
        property: payload.property,
      });
      if (!built.ok) return built;
      var propertyCheck = validateProperty(payload.property);
      if (!propertyCheck.ok) return propertyCheck;
      return hashPassword(built.plainPassword).then(function (digest) {
        var user = {
          name: built.user.name,
          email: built.user.email,
          password: digest,
          access: built.user.access,
          services: built.user.services,
          property: propertyCheck.property,
        };
        saveUser(user);
        setSession(user);
        return { ok: true, user: getSession() };
      });
    });
  }

  /** Admin-created accounts — validates access/services; does not open a session. */
  function createAccount(payload) {
    return ensureReady().then(function () {
      var built = buildUser(payload);
      if (!built.ok) return built;
      return hashPassword(built.plainPassword).then(function (digest) {
        var user = {
          name: built.user.name,
          email: built.user.email,
          password: digest,
          access: built.user.access,
          services: built.user.services,
        };
        saveUser(user);
        return {
          ok: true,
          user: {
            name: user.name,
            email: user.email,
            access: user.access,
            services: user.services,
          },
        };
      });
    });
  }

  function login(email, password) {
    var V = window.HandsValidate;
    return ensureReady().then(function () {
      var emailCheck = V.email(email);
      if (!emailCheck.ok) return { ok: false, field: "email", message: emailCheck.error };
      var passCheck = V.loginPassword(password);
      if (!passCheck.ok) return { ok: false, field: "password", message: passCheck.error };
      var user = findByEmail(email);
      if (!user) return { ok: false, field: "form", message: V.t("loginInvalid") };
      return verifyPassword(password, user.password).then(function (match) {
        if (!match) return { ok: false, field: "form", message: V.t("loginInvalid") };
        // Upgrade any leftover plaintext hashes after a successful login.
        if (!isHashed(user.password)) {
          return hashPassword(password).then(function (digest) {
            var accounts = readAccounts().map(function (account) {
              if (account.email !== user.email) return account;
              return {
                name: account.name,
                email: account.email,
                password: digest,
                access: account.access,
                services: account.services || [],
                property: normalizeProperty(account.property),
              };
            });
            writeAccounts(accounts);
            setSession(Object.assign({}, user, { password: digest }));
            return { ok: true, user: getSession() };
          });
        }
        setSession(user);
        return { ok: true, user: getSession() };
      });
    });
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  /** Reload session snapshot from the accounts store (e.g. after demo property seed). */
  function refreshSession() {
    var session = getSession();
    if (!session) return null;
    var account = findByEmail(session.email);
    if (!account) return session;
    return setSession(account);
  }

  /** Update host display name on the logged-in account. */
  function updateProfile(payload) {
    return ensureReady().then(function () {
      var V = window.HandsValidate;
      var session = getSession();
      if (!session || session.access !== "host") {
        return { ok: false, message: V.t("accountNeedHost") };
      }
      var name = V.compactSpaces(payload && payload.name);
      var nameCheck = V.personName(name);
      if (!nameCheck.ok) return { ok: false, field: "name", message: nameCheck.error };

      var accounts = readAccounts().map(function (account) {
        if (account.email !== session.email) return account;
        return Object.assign({}, account, { name: name });
      });
      writeAccounts(accounts);
      var updated = findByEmail(session.email);
      setSession(updated);
      return { ok: true, user: getSession() };
    });
  }

  /** Update host property / access details on the logged-in account. */
  function updateProperty(payload) {
    return ensureReady().then(function () {
      var V = window.HandsValidate;
      var session = getSession();
      if (!session || session.access !== "host") {
        return { ok: false, message: V.t("accountNeedHost") };
      }
      var propertyCheck = validateProperty(payload);
      if (!propertyCheck.ok) return propertyCheck;

      var accounts = readAccounts().map(function (account) {
        if (account.email !== session.email) return account;
        return Object.assign({}, account, { property: propertyCheck.property });
      });
      writeAccounts(accounts);
      var updated = findByEmail(session.email);
      setSession(updated);
      return { ok: true, user: getSession() };
    });
  }

  ensureReady();

  /* --- Public API --- */
  return {
    register: register,
    createAccount: createAccount,
    login: login,
    logout: logout,
    updateProfile: updateProfile,
    updateProperty: updateProperty,
    validateProperty: validateProperty,
    refreshSession: refreshSession,
    getSession: getSession,
    isLoggedIn: function () {
      return !!getSession();
    },
    findByEmail: findByEmail,
    normalizeProperty: normalizeProperty,
    propertyToPlace: propertyToPlace,
    ready: ensureReady,
  };
})();
