// Popup: estado de hoy + gráfico simple de 7 días (canvas, sin librerías).
async function load() {
  const s = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
  document.getElementById("attemptsToday").textContent = s.attemptsToday;
  document.getElementById("graceLeft").textContent = s.graceMax - s.graceUsedToday;
  document.getElementById("rulesCount").textContent = s.rulesCount;

  const btn = document.getElementById("graceBtn");
  const banner = document.getElementById("graceBanner");
  if (s.graceActive) {
    btn.disabled = true;
    btn.textContent = "Gracia activa ✓";
    banner.hidden = false;
    tickBanner(banner, s.graceUntil);
  } else if (s.graceUsedToday >= s.graceMax) {
    btn.disabled = true;
    btn.textContent = "Pases agotados por hoy";
  } else {
    btn.onclick = async () => {
      const r = await chrome.runtime.sendMessage({ type: "REQUEST_GRACE" });
      if (r.ok) load();
    };
  }

  drawChart(s.weekly);
  const total = s.weekly.reduce((a, d) => a + d.count, 0);
  document.getElementById("weekTotal").textContent =
    total === 0 ? "Sin bloqueos esta semana. ¡Buen enfoque!" : `${total} bloqueos en 7 días`;
}

function tickBanner(el, until) {
  const tick = () => {
    const left = Math.max(0, until - Date.now());
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    el.textContent = `🌿 Gracia activa: ${m}:${String(s).padStart(2, "0")} restantes`;
    if (left <= 0) load();
    else setTimeout(tick, 1000);
  };
  tick();
}

function drawChart(weekly) {
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  // Soporte HiDPI
  const dpr = window.devicePixelRatio || 1;
  const W = 320, H = 140;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.height = H + "px";
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const max = Math.max(1, ...weekly.map((d) => d.count));
  const n = weekly.length;
  const gap = 10, padL = 6, padB = 22, padT = 12;
  const bw = (W - padL * 2 - gap * (n - 1)) / n;
  const todayKey = EnfoqueUtils.dayKey(new Date());

  weekly.forEach((d, i) => {
    const h = ((H - padT - padB) * d.count) / max;
    const x = padL + i * (bw + gap);
    const y = H - padB - h;
    const isToday = d.day === todayKey;
    ctx.fillStyle = d.count === 0 ? "#d8d3c4" : isToday ? "#1d5c36" : "#2f7d4f";
    ctx.beginPath();
    ctx.roundRect(x, Math.max(y, padT), bw, Math.max(h, d.count > 0 ? 4 : 2), 5);
    ctx.fill();
    // valor
    ctx.fillStyle = "#555";
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    if (d.count > 0) ctx.fillText(String(d.count), x + bw / 2, y - 3);
    // etiqueta día
    ctx.fillStyle = isToday ? "#1d5c36" : "#888";
    ctx.font = (isToday ? "bold " : "") + "10px system-ui";
    ctx.fillText(EnfoqueUtils.shortLabel(d.day), x + bw / 2, H - 7);
  });
}

load();
