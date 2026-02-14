// backend/public/admin-ops.js — Phase 12.1 (extracted from admin-ops.html for CSP script-src 'self')
(function () {
  let adminToken = "";
  window.__setAdminToken = function (token) {
    adminToken = (token || "").trim().replace(/^Bearer\s+/i, "");
    const input = document.getElementById("tokenInput");
    if (input) input.value = adminToken;
  };
  const tokenInput = document.getElementById("tokenInput");
  const saveBtn = document.getElementById("saveToken");
  const refreshBtn = document.getElementById("refresh");
  const errorEl = document.getElementById("error");
  const stateEl = document.getElementById("state");
  const decisionEl = document.getElementById("decision");
  const incidentsEl = document.getElementById("incidents");
  const auditsEl = document.getElementById("audits");
  const notificationsEl = document.getElementById("notifications");
  const notificationFilterSelect = document.getElementById("notificationFilter");
  const envBadge = document.getElementById("envBadge");
  const levelSelect = document.getElementById("level");
  const setLevelBtn = document.getElementById("setLevel");
  const killSwitchOnBtn = document.getElementById("killSwitchOn");
  const killSwitchOffBtn = document.getElementById("killSwitchOff");
  const auditFilterSelect = document.getElementById("auditFilter");

  function getToken() {
    return adminToken || (tokenInput && tokenInput.value.trim()) || "";
  }
  function setToken(t) {
    adminToken = t ? t.replace(/^Bearer\s+/i, "") : "";
  }
  function headers() {
    const t = getToken();
    return t ? { Authorization: "Bearer " + t.replace(/^Bearer\s+/i, ""), "Content-Type": "application/json" } : {};
  }

  function setError(msg) {
    if (errorEl) errorEl.textContent = msg || "";
  }

  async function api(path, opts) {
    opts = opts || {};
    const res = await fetch(path, { credentials: "same-origin", ...opts, headers: { ...headers(), ...(opts.headers || {}) } });
    if (res.status === 401 || res.status === 403) {
      setError("Unauthorized. Paste a valid admin token.");
      throw new Error(res.status + " Unauthorized");
    }
    if (!res.ok) throw new Error(res.status + " " + (await res.text()));
    return res.json();
  }

  async function load() {
    setError("");
    try {
      const status = await api("/api/ops/status");
      if (envBadge) envBadge.textContent = status.env || "—";
      if (stateEl) {
        stateEl.innerHTML =
          "Level: <span class=\"badge badge-" +
          status.automationLevel +
          "\">" +
          status.automationLevel +
          "</span> " +
          (status.dryRun ? " <span class=\"badge badge-dry_run\">dry-run</span>" : "") +
          " Kill-switch: " +
          (status.manualKillSwitch ? "ON" : "OFF") +
          " Open incidents: " +
          status.openIncidents;
      }
      if (levelSelect) levelSelect.value = status.automationLevel;

      if (decisionEl) decisionEl.textContent = status.lastDecision ? JSON.stringify(status.lastDecision, null, 2) : "—";

      const inc = await api("/api/ops/incidents?status=OPEN&limit=20");
      if (incidentsEl) {
        incidentsEl.innerHTML =
          inc.incidents && inc.incidents.length
            ? "<table><tr><th>Type</th><th>Severity</th><th>Created</th><th>Status</th></tr>" +
              inc.incidents
                .map(
                  (i) =>
                    "<tr><td>" +
                    (i.type || "") +
                    "</td><td>" +
                    (i.severity || "") +
                    "</td><td>" +
                    (i.createdAt || "") +
                    "</td><td>" +
                    (i.status || "") +
                    "</td></tr>"
                )
                .join("") +
              "</table>"
            : "None";
      }

      const auditFilter = auditFilterSelect ? auditFilterSelect.value : "";
      const audPath = auditFilter ? "/api/ops/audits?limit=50&result=" + encodeURIComponent(auditFilter) : "/api/ops/audits?limit=50";
      const aud = await api(audPath);
      if (auditsEl) {
        auditsEl.innerHTML =
          aud.audits && aud.audits.length
            ? "<table><tr><th>Action</th><th>Result</th><th>Time</th></tr>" +
              aud.audits
                .map(
                  (a) =>
                    "<tr><td>" +
                    (a.actionType || "") +
                    "</td><td><span class=\"badge badge-" +
                    (a.result || "") +
                    "\">" +
                    (a.result || "") +
                    "</span></td><td>" +
                    (a.createdAt || "") +
                    "</td></tr>"
                )
                .join("") +
              "</table>"
            : "None";
      }

      const notifFilter = notificationFilterSelect ? notificationFilterSelect.value : "";
      const notifPath = notifFilter
        ? "/api/ops/notifications?limit=50&result=" + encodeURIComponent(notifFilter)
        : "/api/ops/notifications?limit=50";
      const notif = await api(notifPath);
      if (notificationsEl) {
        notificationsEl.innerHTML =
          notif.notifications && notif.notifications.length
            ? "<table><tr><th>Time</th><th>Event</th><th>Channel</th><th>Result</th><th>Incident</th><th>Error</th></tr>" +
              notif.notifications
                .map(
                  (n) =>
                    "<tr><td>" +
                    (n.createdAt ? (typeof n.createdAt === "string" ? n.createdAt : n.createdAt.toISOString && n.createdAt.toISOString()) : "") +
                    "</td><td>" +
                    (n.eventType || "") +
                    "</td><td>" +
                    (n.channel || "") +
                    "</td><td><span class=\"badge badge-" +
                    (n.result || "") +
                    "\">" +
                    (n.result || "") +
                    "</span></td><td>" +
                    (n.incidentId ? String(n.incidentId) : "—") +
                    "</td><td>" +
                    (n.errorMessage || "—") +
                    "</td></tr>"
                )
                .join("") +
              "</table>"
            : "None";
      }
    } catch (e) {
      setError(e.message || "Load failed");
    }
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      const t = tokenInput ? tokenInput.value.trim().replace(/^Bearer\s+/i, "") : "";
      if (t) setToken(t);
      setError("");
      load();
    });
  }
  if (refreshBtn) refreshBtn.addEventListener("click", load);
  if (auditFilterSelect) auditFilterSelect.addEventListener("change", load);
  if (notificationFilterSelect) notificationFilterSelect.addEventListener("change", load);

  if (setLevelBtn) {
    setLevelBtn.addEventListener("click", async function () {
      if (!levelSelect || !confirm("Set automation level to " + levelSelect.value + "?")) return;
      setError("");
      try {
        await api("/api/ops/level", { method: "POST", body: JSON.stringify({ level: levelSelect.value }) });
        load();
      } catch (e) {
        setError(e.message);
      }
    });
  }
  if (killSwitchOnBtn) {
    killSwitchOnBtn.addEventListener("click", async function () {
      if (!confirm("Enable manual kill-switch? Autopilot will not take actions.")) return;
      setError("");
      try {
        await api("/api/ops/kill-switch", { method: "POST", body: JSON.stringify({ enabled: true }) });
        load();
      } catch (e) {
        setError(e.message);
      }
    });
  }
  if (killSwitchOffBtn) {
    killSwitchOffBtn.addEventListener("click", async function () {
      if (!confirm("Disable manual kill-switch?")) return;
      setError("");
      try {
        await api("/api/ops/kill-switch", { method: "POST", body: JSON.stringify({ enabled: false }) });
        load();
      } catch (e) {
        setError(e.message);
      }
    });
  }

  if (getToken()) load();
})();
