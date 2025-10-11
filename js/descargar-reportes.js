// ./js/descargar-reportes.js
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './firebase-config.js';
import { showAlert } from './showAlert.js';

/* =============== Utilidades =============== */
function tzNowCR() {
  const fmtD = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica', year:'numeric', month:'2-digit', day:'2-digit' });
  const fmtT = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Costa_Rica', hour:'2-digit', minute:'2-digit', hour12:false });
  return { date: fmtD.format(new Date()), time: fmtT.format(new Date()) }; // ("YYYY-MM-DD","HH:MM")
}

async function ensureXLSX() {
  if (typeof window.XLSX !== 'undefined') return true;
  try {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return typeof window.XLSX !== 'undefined';
  } catch {
    return false;
  }
}

function autosizeColumnsFromAOA(aoa) {
  const widths = [];
  for (const row of aoa) {
    row.forEach((cell, i) => {
      const len = (cell == null ? 0 : String(cell)).length;
      widths[i] = Math.max(widths[i] || 6, Math.min(40, len + 2));
    });
  }
  return widths.map(w => ({ wch: w }));
}

function toYesNo(v) { return v ? 'Sí' : 'No'; }

/* =============== Descarga de Reporte =============== */
async function descargarReporteAsistencia() {
  const btn = document.getElementById('btnDescargar');
  if (!btn) return;

  if (!(await ensureXLSX())) {
    showAlert("La librería XLSX no está disponible", "error");
    return;
  }

  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  const originalText = btn.textContent;
  const setProgress = (t) => { if (btn) btn.textContent = t; };

  try {
    setProgress('Preparando…');

    // 1) Fechas de asistencias
    const fechasSnap = await getDocs(collection(db, 'asistencias'));
    if (fechasSnap.empty) {
      showAlert('No hay registros de asistencia disponibles', 'error');
      return;
    }

    const fechas = fechasSnap.docs.map(d => d.id).sort(); // "YYYY-MM-DD" asc

    // 2) Descargar subcolecciones en lotes (para no saturar)
    const CONCURRENCY = 8;
    let idx = 0;

    const detalleAOA = [["Fecha", "Nombre", "Hora", "Presente"]];
    const resumenMap = new Map(); // fecha => { total, presentes }

    async function fetchLote() {
      const slice = fechas.slice(idx, idx + CONCURRENCY);
      idx += CONCURRENCY;

      const promesas = slice.map(async (fecha) => {
        const sub = await getDocs(collection(db, `asistencias/${fecha}/usuarios`));
        let total = 0, presentes = 0;

        sub.forEach(u => {
          const d = u.data() || {};
          total += 1;
          if (d.presente) presentes += 1;

          detalleAOA.push([
            fecha,
            d.nombre || '—',
            d.hora || '—',
            toYesNo(!!d.presente)
          ]);
        });

        const prev = resumenMap.get(fecha) || { total: 0, presentes: 0 };
        resumenMap.set(fecha, { total: prev.total + total, presentes: prev.presentes + presentes });
      });

      await Promise.all(promesas);
    }

    while (idx < fechas.length) {
      setProgress(`Descargando… ${Math.min(idx + CONCURRENCY, fechas.length)}/${fechas.length}`);
      await fetchLote();
    }

    // 3) Ordenar detalle por fecha y nombre (manteniendo encabezado)
    const header = detalleAOA.shift();
    detalleAOA.sort((a, b) => {
      if (a[0] < b[0]) return -1;
      if (a[0] > b[0]) return 1;
      const an = (a[1] || '').toString().toLowerCase();
      const bn = (b[1] || '').toString().toLowerCase();
      return an.localeCompare(bn);
    });
    detalleAOA.unshift(header);

    // 4) Construir hoja de resumen (por fecha)
    const resumenAOA = [["Fecha", "Total", "Presentes", "Ausentes", "Asistencia (%)"]];
    for (const fecha of Array.from(resumenMap.keys()).sort()) {
      const { total, presentes } = resumenMap.get(fecha);
      const ausentes = Math.max(0, total - presentes);
      const pct = total > 0 ? Math.round((presentes / total) * 100) : 0;
      resumenAOA.push([fecha, total, presentes, ausentes, pct]);
    }

    // 5) Crear workbook
    setProgress('Generando archivo…');
    const wsDetalle = XLSX.utils.aoa_to_sheet(detalleAOA);
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenAOA);

    wsDetalle['!cols'] = autosizeColumnsFromAOA(detalleAOA);
    wsResumen['!cols'] = autosizeColumnsFromAOA(resumenAOA);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsDetalle, "Asistencia");
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

    // 6) Descargar
    const { date, time } = tzNowCR(); // "YYYY-MM-DD", "HH:MM"
    const safeTime = time.replace(':','');
    const filename = `reporte_asistencia_${date}_${safeTime}.xlsx`;
    XLSX.writeFile(wb, filename);

    showAlert("Reporte descargado exitosamente", "success");
  } catch (error) {
    console.error("Error al generar el reporte:", error);
    showAlert("Hubo un error al generar el reporte", "error");
  } finally {
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    if (btn && originalText) btn.textContent = originalText;
  }
}

/* =============== Wire-up =============== */
window.descargarReporteAsistencia = descargarReporteAsistencia;
document.getElementById('btnDescargar')?.addEventListener('click', descargarReporteAsistencia);
