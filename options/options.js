const DAYS = [
  { n: 1, label: "L" }, { n: 2, label: "M" }, { n: 3, label: "X" },
  { n: 4, label: "J" }, { n: 5, label: "V" }, { n: 6, label: "S" }, { n: 0, label: "D" }
];

const listEl = document.getElementById("list");
const form = document.getElementById("form");
const domainInput = document.getElementById("domain");
const startInput = document.getElementById("start");
const endInput = document.getElementById("end");
const newDaysEl = document.getElementById("newDays");

// Selector de días del formulario (Lun–Vie por defecto)
const newSelected = new Set([1, 2, 3, 4, 5]);
DAYS.forEach(({ n, label }) => {
  const lab = document.createElement("label");
  lab.innerHTML = `<input type="checkbox" data-day="${n}" ${newSelected.has(n) ? "checked" : ""}><span>${label}</span>`;
  lab.querySelector("input").addEventListener("change", (e) => {
    e.target.checked ? newSelected.add(n) : newSelected.delete(n);
  });
  newDaysEl.appendChild(lab);
});

async function getAll() {
  const { rules = [], stats = {} } = await chrome.storage.local.get(["rules", "stats"]);
  return { rules, stats };
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const domain = EnfoqueUtils.normalizeDomain(domainInput.value);
  if (!domain || !domain.includes(".")) {
    alert("Escribe un dominio válido, ej. instagram.com");
    return;
  }
  if (newSelected.size === 0) {
    alert("Elige al menos un día.");
    return;
  }
  const { rules } = await getAll();
  if (rules.some((r) => r.domain === domain)) {
    alert("Ese dominio ya está en la lista. Edítalo desde la lista.");
    return;
  }
  rules.push({
    id: crypto.randomUUID(),
    domain,
    days: [...newSelected].sort(),
    start: startInput.value || "09:00",
    end: endInput.value || "18:00",
    enabled: true
  });
  await chrome.storage.local.set({ rules });
  domainInput.value = "";
  render();
});

async function render() {
  const { rules, stats } = await getAll();
  const today = EnfoqueUtils.dayKey(new Date());
  document.getElementById("attempts").textContent = (stats.daily || {})[today] || 0;
  document.getElementById("graceUsed").textContent = (stats.graceUsed || {})[today] || 0;

  listEl.innerHTML = "";
  if (rules.length === 0) {
    listEl.innerHTML = "<li>Nada por aquí. Añade tu primer distractor arriba 👆</li>";
    return;
  }
  const now = new Date();
  for (const r of rules) {
    const li = document.createElement("li");
    if (!r.enabled) li.classList.add("off");
    const active = EnfoqueUtils.isNowBlocked(r, now);

    li.innerHTML = `
      <span class="badge">${r.domain}</span>
      <span class="meta">${r.start} → ${r.end} ${active ? "· 🔴 bloqueando ahora" : "· 🟢 fuera de horario"}</span>
      <input type="time" value="${r.start}" data-act="start" title="Inicio" />
      <input type="time" value="${r.end}" data-act="end" title="Fin" />
      <span class="day-pills"></span>
      <span class="spacer"></span>
      <button data-act="toggle" class="toggle">${r.enabled ? "Pausar" : "Activar"}</button>
      <button data-act="del" class="del">✕</button>`;

    const pills = li.querySelector(".day-pills");
    DAYS.forEach(({ n, label }) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.className = r.days.includes(n) ? "on" : "";
      b.title = "Alternar día";
      b.onclick = async () => {
        const set = new Set(r.days);
        set.has(n) ? set.delete(n) : set.add(n);
        r.days = [...set].sort();
        await save(rules);
        render();
      };
      pills.appendChild(b);
    });

    li.querySelector('[data-act="start"]').addEventListener("change", async (e) => {
      r.start = e.target.value; await save(rules); render();
    });
    li.querySelector('[data-act="end"]').addEventListener("change", async (e) => {
      r.end = e.target.value; await save(rules); render();
    });
    li.querySelector('[data-act="toggle"]').onclick = async () => {
      r.enabled = !r.enabled; await save(rules); render();
    };
    li.querySelector('[data-act="del"]').onclick = async () => {
      if (!confirm(`¿Dejar de bloquear ${r.domain}?`)) return;
      await chrome.storage.local.set({ rules: rules.filter((x) => x.id !== r.id) });
      render();
    };
    listEl.appendChild(li);
  }
}

async function save(rules) {
  await chrome.storage.local.set({ rules });
}

document.getElementById("resetStats").onclick = async () => {
  if (!confirm("¿Borrar todas las estadísticas?")) return;
  const { stats } = await getAll();
  await chrome.storage.local.set({ stats: { ...stats, daily: {}, graceUsed: {} } });
  render();
};

chrome.storage.onChanged.addListener(render);
render();
