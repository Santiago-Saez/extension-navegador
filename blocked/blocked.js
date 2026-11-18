const params = new URLSearchParams(location.search);
const from = params.get("from") || "";
const rule = params.get("rule") || "";

const domainEl = document.getElementById("domain");
const fromEl = document.getElementById("from");
const attemptsEl = document.getElementById("attempts");
const graceBtn = document.getElementById("graceBtn");
const backBtn = document.getElementById("backBtn");
const graceLeftEl = document.getElementById("graceLeft");
const graceInfo = document.getElementById("graceInfo");
const countdownEl = document.getElementById("countdown");

if (rule) domainEl.textContent = rule;
if (from) fromEl.textContent = from;

backBtn.addEventListener("click", () => history.length > 1 ? history.back() : window.close());

let graceUntil = 0;
let timer = null;

async function refresh() {
  const s = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
  attemptsEl.textContent = s.attemptsToday;
  graceLeftEl.textContent = s.graceMax - s.graceUsedToday;
  graceUntil = s.graceUntil;
  if (s.graceActive) {
    onGraceActive();
  } else if (s.graceUsedToday >= s.graceMax) {
    graceBtn.disabled = true;
    graceBtn.textContent = "Pases agotados por hoy";
    graceInfo.innerHTML = "Ya usaste tus <strong>2 pases</strong> de hoy. Nos vemos mañana 💪";
  }
}

function onGraceActive() {
  graceBtn.disabled = true;
  graceBtn.textContent = "Gracia activa ✓";
  countdownEl.hidden = false;
  clearInterval(timer);
  const tick = () => {
    const left = Math.max(0, graceUntil - Date.now());
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    countdownEl.textContent = `Acceso libre por ${m}:${String(s).padStart(2, "0")} — aprovecha`;
    if (left <= 0) { clearInterval(timer); location.reload(); }
  };
  tick();
  timer = setInterval(tick, 1000);
  // Si hay URL origen, ofrece continuar
  if (from && from.startsWith("http")) {
    const go = document.createElement("button");
    go.textContent = "Continuar al sitio →";
    go.onclick = () => (location.href = from);
    graceBtn.after(go);
  }
}

graceBtn.addEventListener("click", async () => {
  graceBtn.disabled = true;
  const r = await chrome.runtime.sendMessage({ type: "REQUEST_GRACE" });
  if (r.ok) {
    graceUntil = r.graceUntil;
    onGraceActive();
    await refresh();
  } else {
    graceBtn.textContent = "Pases agotados por hoy";
    await refresh();
  }
});

refresh();
