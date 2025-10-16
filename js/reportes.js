// ./js/reportes.js
import { db } from "./firebase-config.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  getDocs,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { gateAdmin } from './role-guard.js';
await gateAdmin(); // redirige a client-dashboard si no es admin

/* ─────────────────────────────────────────────────────────────
   UTILIDADES DE RENDER
   ───────────────────────────────────────────────────────────── */
function generarTablaPorFecha(fecha, data) {
  let html = `
    <h3>Asistencia del ${fecha}</h3>
    <table class="asistencia-table">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Hora</th>
          <th>Presente</th>
        </tr>
      </thead>
      <tbody>
  `;
  for (const u of data) {
    html += `
      <tr>
        <td>${u.nombre ?? "—"}</td>
        <td>${u.hora ?? "—"}</td>
        <td>${u.presente ? "✅" : "❌"}</td>
      </tr>
    `;
  }
  html += `
      </tbody>
    </table>
  `;
  return html;
}

function renderizarTablaEnDOM(fecha, asistenciaData) {
  const container = document.getElementById("reporte-container");
  if (!container) return;
  const wrapperId = `tabla-${fecha.replace(/[^\w-]/g, "-")}`;

  let wrapper = document.getElementById(wrapperId);
  if (!wrapper) {
    wrapper = document.createElement("div");
    wrapper.id = wrapperId;
    wrapper.classList.add("mb-4");
    container.appendChild(wrapper);
  }
  wrapper.innerHTML = generarTablaPorFecha(fecha, asistenciaData);
}

function eliminarTablaDeDOM(fecha) {
  const wrapperId = `tabla-${fecha.replace(/[^\w-]/g, "-")}`;
  document.getElementById(wrapperId)?.remove();
}

/* ─────────────────────────────────────────────────────────────
   ESTADO DE LISTENERS Y CACHE
   ───────────────────────────────────────────────────────────── */
let subUnsubsUsuarios = {};     // { fecha: () => void }
let lastSigPorFecha   = {};     // { fecha: "hash" }
let unsubscribeAsistencias = null;

/* Limpia TODOS los listeners y la UI */
export function stopRealTimeReporting() {
  Object.values(subUnsubsUsuarios).forEach(unsub => { try { unsub(); } catch {} });
  subUnsubsUsuarios = {};
  lastSigPorFecha = {};
  try { unsubscribeAsistencias?.(); } catch {}
  unsubscribeAsistencias = null;
  const container = document.getElementById("reporte-container");
  if (container) container.innerHTML = "";
}

/* Hash simple para evitar re-renders innecesarios */
function firmaAsistencia(list) {
  // Ordenamos por (hora,nombre) para obtener firma estable
  const norm = (s) => (s ?? "").toString().toLowerCase();
  const copy = [...list].sort((a, b) => {
    const ha = norm(a.hora), hb = norm(b.hora);
    if (ha < hb) return -1; if (ha > hb) return 1;
    const na = norm(a.nombre), nb = norm(b.nombre);
    return na.localeCompare(nb);
  });
  return JSON.stringify(copy.map(x => [x.nombre || "", x.hora || "", !!x.presente]));
}

/* Mostrar mensaje en el contenedor */
function setContainerMessage(msg) {
  const container = document.getElementById("reporte-container");
  if (container) container.innerHTML = `<p>${msg}</p>`;
}

/* ─────────────────────────────────────────────────────────────
   TIEMPO REAL POR MES (YYYY y MM)
   ───────────────────────────────────────────────────────────── */
export async function startRealTimeReporting(month) {
  // month: "01".."12"
  const container = document.getElementById("reporte-container");
  if (!container) return;

  // reset UI/listeners del intento anterior
  stopRealTimeReporting();

  // Año actual (con la estructura actual de IDs "YYYY-MM-DD" no podemos filtrar en servidor)
  const currentYear = new Date().getFullYear();
  const prefijo = `${currentYear}-${String(month).padStart(2, "0")}`; // "YYYY-MM"

  try {
    // 1) Cargar todas las fechas de 'asistencias' (IDs)
    const asistenciasColl = collection(db, "asistencias");
    const snapshotAll = await getDocs(asistenciasColl);
    const fechasDisponibles = snapshotAll.docs.map(d => d.id);
    const fechasDelMes = fechasDisponibles.filter(f => f.startsWith(prefijo)).sort();

    if (!fechasDelMes.length) {
      setContainerMessage("No hay reportes para el mes seleccionado.");
      return;
    }

    // 2) Suscribirse a cada subcolección usuarios (ordenada por hora, si existe)
    for (const fecha of fechasDelMes) {
      if (subUnsubsUsuarios[fecha]) continue;

      const usuariosRef = collection(db, "asistencias", fecha, "usuarios");
      // orderBy('hora') asume que existe; si en alguna fila falta, simplemente se ordena con "undefined" al inicio/fin
      const qUsuarios = query(usuariosRef, orderBy("hora", "asc"));

      subUnsubsUsuarios[fecha] = onSnapshot(
        qUsuarios,
        (usuariosSnap) => {
          const asistenciaData = [];
          usuariosSnap.forEach(docUser => {
            const d = docUser.data() || {};
            asistenciaData.push({ id: docUser.id, nombre: d.nombre, hora: d.hora, presente: !!d.presente });
          });

          const firma = firmaAsistencia(asistenciaData);
          if (lastSigPorFecha[fecha] === firma) return; // sin cambios relevantes
          lastSigPorFecha[fecha] = firma;

          renderizarTablaEnDOM(fecha, asistenciaData);
        },
        (err) => {
          console.error(`Error escuchando asistencias/${fecha}/usuarios:`, err);
        }
      );
    }

    // 3) Listener global para detectar altas/bajas de fechas y reajustar
    unsubscribeAsistencias = onSnapshot(
      asistenciasColl,
      (snap) => {
        const todasFechas = snap.docs.map(d => d.id);
        const nuevasFechasDelMes = todasFechas.filter(f => f.startsWith(prefijo)).sort();

        // Fechas a desuscribir (ya no pertenecen al mes)
        for (const f of Object.keys(subUnsubsUsuarios)) {
          if (!nuevasFechasDelMes.includes(f)) {
            try { subUnsubsUsuarios[f](); } catch {}
            delete subUnsubsUsuarios[f];
            delete lastSigPorFecha[f];
            eliminarTablaDeDOM(f);
          }
        }
        // Fechas nuevas del mes (suscribirse)
        nuevasFechasDelMes.forEach(fecha => {
          if (!subUnsubsUsuarios[fecha]) {
            const usuariosRef = collection(db, "asistencias", fecha, "usuarios");
            const qUsuarios = query(usuariosRef, orderBy("hora", "asc"));
            subUnsubsUsuarios[fecha] = onSnapshot(
              qUsuarios,
              (usuariosSnap) => {
                const asistenciaData = [];
                usuariosSnap.forEach(docUser => {
                  const d = docUser.data() || {};
                  asistenciaData.push({ id: docUser.id, nombre: d.nombre, hora: d.hora, presente: !!d.presente });
                });
                const firma = firmaAsistencia(asistenciaData);
                if (lastSigPorFecha[fecha] === firma) return;
                lastSigPorFecha[fecha] = firma;
                renderizarTablaEnDOM(fecha, asistenciaData);
              },
              (err) => console.error(`Error RT en ${fecha}:`, err)
            );
          }
        });

        // Si no queda nada del mes, mensaje vacío
        const hayAlgo = nuevasFechasDelMes.length > 0;
        if (!hayAlgo) setContainerMessage("No hay reportes para el mes seleccionado.");
      },
      (err) => {
        console.error("Error en listener global de 'asistencias':", err);
      }
    );
  } catch (err) {
    console.error("❌ Error en startRealTimeReporting:", err);
    setContainerMessage("Error al cargar los reportes. Revisa la consola.");
  }
}

/* ─────────────────────────────────────────────────────────────
   ATÁJALO DESDE EL HTML (botón/selector)
   ───────────────────────────────────────────────────────────── */
window.getAsistencia = function () {
  const sel = document.getElementById("monthSelect");
  const month = sel?.value || String(new Date().getMonth() + 1).padStart(2, "0");
  startRealTimeReporting(month);
};

// (Opcional) expón el stop por si cambias de vista/pestaña
window.stopRealTimeReporting = stopRealTimeReporting;
