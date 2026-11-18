// Utilidades compartidas (service worker vía importScripts, páginas vía <script>).
// Se expone como global `EnfoqueUtils` para no depender de módulos ES en el SW.
(function (root) {
  const DAY_NAMES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

  function normalizeDomain(input) {
    return String(input || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .split(":")[0]
      .trim();
  }

  function domainMatches(host, ruleDomain) {
    host = String(host || "").toLowerCase().replace(/^www\./, "");
    ruleDomain = normalizeDomain(ruleDomain);
    if (!host || !ruleDomain) return false;
    return host === ruleDomain || host.endsWith("." + ruleDomain);
  }

  function toMinutes(hhmm) {
    const [h, m] = String(hhmm || "00:00").split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  // day: 0=domingo..6=sábado, como Date.getDay()
  function isNowBlocked(rule, now) {
    if (!rule || !rule.enabled) return false;
    if (!Array.isArray(rule.days) || !rule.days.includes(now.getDay())) return false;
    const cur = now.getHours() * 60 + now.getMinutes();
    const start = toMinutes(rule.start);
    const end = toMinutes(rule.end);
    if (start === end) return true; // 00:00-00:00 = todo el día
    if (start < end) return cur >= start && cur < end;
    return cur >= start || cur < end; // rango nocturno, ej. 22:00-06:00
  }

  function dayKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function last7Days(base = new Date()) {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      out.push(dayKey(d));
    }
    return out;
  }

  function shortLabel(dayKeyStr) {
    const d = new Date(dayKeyStr + "T12:00:00");
    return DAY_NAMES[d.getDay()];
  }

  root.EnfoqueUtils = {
    normalizeDomain,
    domainMatches,
    toMinutes,
    isNowBlocked,
    dayKey,
    last7Days,
    shortLabel,
    DAY_NAMES
  };
})(typeof self !== "undefined" ? self : globalThis);
