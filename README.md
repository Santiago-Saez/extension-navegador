# 🧠 Enfoque — Bloqueador de sitios por horario (Manifest V3)

Extensión de Chrome/Edge/Brave que bloquea dominios según **horarios por día de la semana**, con página de bloqueo propia, modo de gracia limitado y estadísticas semanales.

## Funciones

- **Lista de dominios con horario por día**: cada regla tiene dominio, días (L–D), hora inicio/fin y on/off. `00:00 → 00:00` = todo el día; rangos como `22:00 → 06:00` cruzan la medianoche. Los subdominios se incluyen (`youtube.com` cubre `m.youtube.com`).
- **Página de bloqueo propia** (`blocked/`): muestra el dominio, la URL intentada y **cuántos intentos llevas hoy**.
- **Modo "5 minutos de gracia"**: botón en la página de bloqueo y en el popup. Libera la navegación por 5 minutos, **máximo 2 veces al día**. Al agotarse, el botón se deshabilita hasta mañana.
- **Estadísticas semanales en el popup**: intentos bloqueados de hoy, pases restantes y **gráfico de barras de 7 días** dibujado en `<canvas>` sin librerías.

## Estructura

```
manifest.json
background/background.js   # service worker: detecta navegaciones y redirige
lib/utils.js               # lógica compartida (matching, horarios, fechas)
blocked/                   # página de bloqueo + contador + botón gracia
popup/                     # popup + gráfico semanal
options/                   # gestión de reglas y horarios
icons/                     # icon16/48/128.png
```

## Permisos del manifest — justificación

| Permiso | Por qué es necesario | Por qué no se pidió otra cosa |
|---|---|---|
| `storage` | Guardar reglas, conteo diario de intentos (`stats.daily`), pases de gracia usados y `graceUntil`. Sin esto no hay persistencia. | — |
| `alarms` | Crear alarma `midnight-cleanup` (poda de stats >14 días) y `grace-end` (fin de la gracia de 5 min). Despierta al service worker sin polling. | No se usa polling ni `setInterval` en segundo plano. |
| `tabs` | Detectar la URL de la pestaña (`tabs.onUpdated`) y redirigirla a la página de bloqueo (`tabs.update`). Es la forma de bloquear **sin pedir acceso al contenido de las páginas**. | — |
| ~~`host_permissions`~~ | **No se piden.** El bloqueo se hace redirigiendo la pestaña, no inyectando nada en los sitios. | Evita `<all_urls>` y el aviso "puede leer todos tus datos". |
| ~~`webNavigation` / `declarativeNetRequest` / `webRequest`~~ | **No se piden.** `tabs.onUpdated` es suficiente y menos invasivo. | Menos superficie de permisos = instalación más confiable. |
| ~~`cookies` / `history` / `bookmarks`~~ | **No se piden.** No se necesitan. | Principio de mínimo privilegio. |

## Probarla

1. Ve a `chrome://extensions`, activa **modo desarrollador**.
2. **Cargar descomprimida** → selecciona esta carpeta.
3. Abre **Opciones** (⚙️) y añade reglas, ej. `instagram.com` Lun–Vie `09:00 → 18:00`.
4. Visita ese dominio dentro del horario → verás la página de bloqueo con tu contador.
5. Usa el pase de gracia (2/día) y revisa el popup para el gráfico semanal.

## Notas de diseño

- La gracia se guarda como `stats.graceUntil` (timestamp) + `stats.graceUsed[dayKey]`; el service worker la consulta en cada navegación.
- El conteo es por fecha local (`YYYY-MM-DD`); el popup y la página de bloqueo lo leen vía mensaje `GET_STATUS`.
- Sin dependencias externas: HTML/CSS/JS vainilla.
