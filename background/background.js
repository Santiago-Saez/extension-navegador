// Service Worker — Enfoque (Manifest V3)
// Solo usa tabs.onUpdated: no necesita host_permissions ni webNavigation.

importScripts("../lib/utils.js");

const BLOCKED_PAGE = "blocked/blocked.html";
const GRACE_MINUTES = 5;
const GRACE_MAX_PER_DAY = 2;

chrome.runtime.onInstalled.addListener(async (details) => {
  const data = await chrome.storage.local.get(["rules", "stats"]);
  if (!data.rules) {
    await chrome.storage.local.set({
      rules: [
        {
          id: crypto.randomUUID(),
          domain: "youtube.com",
          days: [1, 2, 3, 4, 5],
          start: "09:00",
          end: "18:00",
          enabled: true
        },
        {
          id: crypto.randomUUID(),
          domain: "x.com",
          days: [1, 2, 3, 4, 5],
          start: "09:00",
          end: "18:00",
          enabled: true
        }
      ]
    });
  }
  if (!data.stats) {
    await chrome.storage.local.set({ stats: { daily: {}, graceUsed: {}, graceUntil: 0 } });
  }
  await scheduleMidnightAlarm();
});

chrome.runtime.onStartup.addListener(scheduleMidnightAlarm);

async function scheduleMidnightAlarm() {
  try {
    await chrome.alarms.clear("midnight-cleanup");
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 5, 0);
    await chrome.alarms.create("midnight-cleanup", {
      when: midnight.getTime(),
      periodInMinutes: 60 * 24
    });
  } catch (_) {
    // alarms es opcional en la práctica; el conteo por fecha funciona igual
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "midnight-cleanup") await pruneOldStats();
  if (alarm.name === "grace-end") {
    // La gracia expiró; no cerramos pestañas, solo vuelve a bloquear
    // en la próxima navegación. Se notifica al popup si está abierto.
  }
});

async function pruneOldStats() {
  const { stats } = await chrome.storage.local.get("stats");
  if (!stats) return;
  const keep = {};
  const cutoff = Date.now() - 14 * 864e5;
  for (const [day, n] of Object.entries(stats.daily || {})) {
    if (new Date(day + "T12:00:00").getTime() >= cutoff) keep[day] = n;
  }
  const graceUsed = {};
  for (const [day, n] of Object.entries(stats.graceUsed || {})) {
    if (new Date(day + "T12:00:00").getTime() >= cutoff) graceUsed[day] = n;
  }
  await chrome.storage.local.set({ stats: { ...stats, daily: keep, graceUsed } });
}

// Escucha principal: detecta navegaciones completadas o en curso.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "loading") return;
  const url = changeInfo.url || tab.url;
  if (!url || !url.startsWith("http")) return;
  // Evita bucle con la propia página de bloqueo
  if (url.startsWith(chrome.runtime.getURL(""))) return;

  const match = await findBlockingRule(url);
  if (!match) return;

  await registerAttempt();
  const target =
    chrome.runtime.getURL(BLOCKED_PAGE) +
    "?from=" + encodeURIComponent(url) +
    "&rule=" + encodeURIComponent(match.domain);
  try {
    await chrome.tabs.update(tabId, { url: target });
  } catch (_) {
    // La pestaña pudo cerrarse; no es error.
  }
});

async function findBlockingRule(url) {
  const { rules = [], stats = {} } = await chrome.storage.local.get(["rules", "stats"]);
  if (stats.graceUntil && stats.graceUntil > Date.now()) return null; // gracia activa
  let host;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  const now = new Date();
  return (
    rules.find(
      (r) =>
        r.enabled &&
        EnfoqueUtils.domainMatches(host, r.domain) &&
        EnfoqueUtils.isNowBlocked(r, now)
    ) || null
  );
}

async function registerAttempt() {
  const today = EnfoqueUtils.dayKey(new Date());
  const { stats = { daily: {}, graceUsed: {}, graceUntil: 0 } } =
    await chrome.storage.local.get("stats");
  const daily = { ...(stats.daily || {}) };
  daily[today] = (daily[today] || 0) + 1;
  await chrome.storage.local.set({ stats: { ...stats, daily } });
}

// Mensajes del popup / página de bloqueo
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "REQUEST_GRACE") {
      sendResponse(await grantGrace());
    } else if (msg.type === "GET_STATUS") {
      const { rules = [], stats = {} } = await chrome.storage.local.get(["rules", "stats"]);
      const today = EnfoqueUtils.dayKey(new Date());
      sendResponse({
        attemptsToday: (stats.daily || {})[today] || 0,
        graceUsedToday: (stats.graceUsed || {})[today] || 0,
        graceMax: GRACE_MAX_PER_DAY,
        graceMinutes: GRACE_MINUTES,
        graceUntil: stats.graceUntil || 0,
        graceActive: (stats.graceUntil || 0) > Date.now(),
        weekly: EnfoqueUtils.last7Days().map((d) => ({
          day: d,
          count: (stats.daily || {})[d] || 0
        })),
        rulesCount: rules.length
      });
    }
  })();
  return true; // respuesta asíncrona
});

async function grantGrace() {
  const today = EnfoqueUtils.dayKey(new Date());
  const { stats = { daily: {}, graceUsed: {}, graceUntil: 0 } } =
    await chrome.storage.local.get("stats");
  const used = (stats.graceUsed || {})[today] || 0;
  if ((stats.graceUntil || 0) > Date.now()) {
    return { ok: true, alreadyActive: true, graceUntil: stats.graceUntil, remaining: GRACE_MAX_PER_DAY - used };
  }
  if (used >= GRACE_MAX_PER_DAY) {
    return { ok: false, reason: "limit", remaining: 0 };
  }
  const graceUntil = Date.now() + GRACE_MINUTES * 60e3;
  const graceUsed = { ...(stats.graceUsed || {}), [today]: used + 1 };
  await chrome.storage.local.set({ stats: { ...stats, graceUsed, graceUntil } });
  try {
    await chrome.alarms.create("grace-end", { when: graceUntil });
  } catch (_) {}
  return { ok: true, graceUntil, remaining: GRACE_MAX_PER_DAY - (used + 1) };
}
