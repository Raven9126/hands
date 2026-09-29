/**
 * HandsApi — HTTP client for the Hands Spring Boot API.
 *
 * Base URL resolution (first match wins):
 *   1. window.HANDS_API_URL
 *   2. <meta name="hands-api-url" content="…">
 *   3. localStorage "hands-api-url"
 *   4. http://localhost:8081 (local default)
 *
 * Auth uses Bearer JWT in localStorage ("hands-access-token").
 */
window.HandsApi = (function () {
  var TOKEN_KEY = "hands-access-token";
  var URL_KEY = "hands-api-url";
  var DEFAULT_BASE = "http://localhost:8081";

  function metaApiUrl() {
    var el = document.querySelector('meta[name="hands-api-url"]');
    return el ? String(el.getAttribute("content") || "").trim() : "";
  }

  function baseUrl() {
    var fromWindow =
      typeof window.HANDS_API_URL === "string" ? window.HANDS_API_URL.trim() : "";
    if (fromWindow) return fromWindow.replace(/\/$/, "");
    var fromMeta = metaApiUrl();
    if (fromMeta) return fromMeta.replace(/\/$/, "");
    try {
      var fromStore = localStorage.getItem(URL_KEY);
      if (fromStore) return String(fromStore).trim().replace(/\/$/, "");
    } catch (e) {
      /* ignore */
    }
    return DEFAULT_BASE;
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function setToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function clearToken() {
    setToken("");
  }

  function ApiError(message, options) {
    var err = new Error(message || "Request failed");
    err.name = "HandsApiError";
    err.status = options && options.status != null ? options.status : 0;
    err.code = options && options.code ? options.code : "REQUEST_FAILED";
    err.fields = options && options.fields ? options.fields : null;
    err.body = options && options.body ? options.body : null;
    return err;
  }

  function parseJsonSafe(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  /**
   * Low-level fetch against /api/v1…
   * @param {string} path e.g. "/auth/login"
   * @param {{ method?: string, body?: object|null, auth?: boolean }} [options]
   */
  function request(path, options) {
    var opts = options || {};
    var method = (opts.method || "GET").toUpperCase();
    var headers = { Accept: "application/json" };
    if (opts.body != null) headers["Content-Type"] = "application/json";
    if (opts.auth !== false) {
      var token = getToken();
      if (token) headers.Authorization = "Bearer " + token;
    }

    var url = baseUrl() + "/api/v1" + path;
    return fetch(url, {
      method: method,
      headers: headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    }).then(function (res) {
      return res.text().then(function (text) {
        var body = parseJsonSafe(text);
        if (res.ok) {
          if (res.status === 204) return null;
          return body;
        }
        var message =
          (body && body.message) ||
          (res.status === 0 ? "Network error" : "HTTP " + res.status);
        throw ApiError(message, {
          status: res.status,
          code: (body && body.code) || "HTTP_" + res.status,
          fields: body && body.fields,
          body: body,
        });
      });
    }).catch(function (err) {
      if (err && err.name === "HandsApiError") throw err;
      throw ApiError(
        "Cannot reach API at " + baseUrl() + ". Is the backend running?",
        { status: 0, code: "NETWORK_ERROR" }
      );
    });
  }

  function roleToAccess(role) {
    var value = String(role || "").toUpperCase();
    if (value === "ADMIN") return "admin";
    if (value === "PROVIDER") return "provider";
    return "host";
  }

  /** Map API UserSession → HandsAuth session shape. */
  function toLocalUser(session) {
    if (!session) return null;
    var prop = session.property;
    return {
      id: session.id || null,
      name: session.fullName || "",
      email: session.email || "",
      access: roleToAccess(session.role),
      services: [],
      property: prop
        ? {
            address: prop.addressLine || "",
            unit: prop.unitLabel || "",
            neighborhood: prop.neighborhood || "",
            phone: prop.phone || "",
            inComplex: !!prop.inComplex,
            complexName: prop.complexName || "",
            complexTower: "",
            complexApt: "",
            needsAuth: !!prop.needsAuthorization,
            accessNotes: prop.accessNotes || "",
            citySlug: prop.citySlug || "",
          }
        : null,
    };
  }

  /** Map HandsAuth register property → API PropertyRequest. */
  function toPropertyRequest(raw) {
    if (!raw || typeof raw !== "object") return null;
    var inComplex = !!raw.inComplex;
    var unit = String(raw.unit || "").trim();
    if (inComplex) {
      var parts = [];
      if (raw.complexTower) parts.push(String(raw.complexTower).trim());
      if (raw.complexApt) {
        var apt = String(raw.complexApt).trim();
        parts.push(/apto|apt|ap\.?/i.test(apt) ? apt : "apto " + apt);
      }
      if (parts.length) unit = parts.join(", ");
    }
    return {
      citySlug: raw.citySlug || null,
      addressLine: raw.address || "",
      unitLabel: unit,
      neighborhood: raw.neighborhood || "",
      phone: raw.phone || "",
      inComplex: inComplex,
      complexName: inComplex ? raw.complexName || "" : "",
      needsAuthorization: inComplex ? !!raw.needsAuth : false,
      accessNotes: raw.accessNotes || "",
    };
  }

  function applyTokenResponse(payload) {
    if (!payload || !payload.accessToken) {
      throw ApiError("Missing access token in response", { code: "BAD_RESPONSE" });
    }
    setToken(payload.accessToken);
    return {
      token: payload.accessToken,
      tokenType: payload.tokenType || "Bearer",
      expiresIn: payload.expiresIn,
      user: toLocalUser(payload.user),
    };
  }

  var auth = {
    login: function (email, password) {
      return request("/auth/login", {
        method: "POST",
        auth: false,
        body: { email: email, password: password },
      }).then(applyTokenResponse);
    },
    register: function (payload) {
      return request("/auth/register", {
        method: "POST",
        auth: false,
        body: {
          fullName: payload.fullName || payload.name,
          email: payload.email,
          password: payload.password,
          confirmPassword: payload.confirmPassword || payload.confirm,
          property: toPropertyRequest(payload.property),
        },
      }).then(applyTokenResponse);
    },
    me: function () {
      return request("/auth/me", { method: "GET" }).then(toLocalUser);
    },
    logout: function () {
      return request("/auth/logout", { method: "POST" })
        .catch(function () {
          /* Client discards token even if the call fails (stateless JWT). */
        })
        .then(function () {
          clearToken();
        });
    },
  };

  return {
    baseUrl: baseUrl,
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    request: request,
    auth: auth,
    toLocalUser: toLocalUser,
    ApiError: ApiError,
  };
})();
