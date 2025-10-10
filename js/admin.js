// ./js/admin.js
import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection, query, onSnapshot, getDocs, doc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

/* ===== Helper roles ===== */
const FIXED_ADMIN_UIDS = new Set(["ScODWX8zq1ZXpzbbKk5vuHwSo7N2"]); // maestro

async function getUserRoles(uid) {
  try {
    const s = await getDoc(doc(db, 'users', uid));
    return s.exists() ? (s.data().roles || []) : [];
  } catch { return []; }
}
async function requireAdmin(user) {
  if (!user) return false;
  if (FIXED_ADMIN_UIDS.has(user.uid)) return true;
  const roles = await getUserRoles(user.uid);
  return roles.includes('admin');
}

/* ===== Arranque UI base ===== */
document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, async user => {
    const ok = await requireAdmin(user);
    if (!ok) { window.location.href = './index.html'; return; }
    iniciarPanelAdmin();
  });

  const toggleBtn = document.getElementById('toggleNav');
  const sidebar   = document.getElementById('sidebar');
  if (toggleBtn && sidebar) toggleBtn.addEventListener('click', () => sidebar.classList.toggle('active'));

  if (window.lucide) lucide.createIcons();
});

// Logout (sidebar)
document.getElementById('logoutSidebar')?.addEventListener('click', async e => {
  e.preventDefault();
  try {
    await signOut(auth);
    showAlert("Has cerrado sesión", 'success');
    setTimeout(() => window.location.href = './index.html', 1200);
  } catch (err) {
    console.error('Error al cerrar sesión:', err);
    showAlert('Hubo un problema al cerrar sesión.', 'error');
  }
});

// Botón cerrar popup asistencia (si existe en el DOM)
document.getElementById('cerrarPopupBtn')?.addEventListener('click', cerrarPopup);

/* ===== FullCalendar admin ===== */
function iniciarPanelAdmin() {
  const calendarEl = document.getElementById('calendar-admin');
  if (!calendarEl) return;

  const calendar = new FullCalendar.Calendar(calendarEl, {
    locale: 'es',
    initialView: 'dayGridMonth',
    headerToolbar: { left: '', center: 'title', right: '' },

    events(info, success, failure) {
      const q = query(collection(db, 'reservations'));
      onSnapshot(q, snap => {
        const byDate = {};
        snap.forEach(d => {
          const data = d.data();
          if (!data.date) return;
          byDate[data.date] ??= [];
          byDate[data.date].push(data.nombre || 'Desconocido');
        });
        success(Object.entries(byDate).map(([date, names]) => ({
          title: `${names.length}`,
          start: date,
          allDay: true,
          extendedProps: { names }
        })));
      }, err => { console.error(err); failure(err); });
    },

    eventClick: async info => {
      const day = info.event.startStr;
      const list = await getReservasPorDia(day);
      abrirPopupAsistencia(list, day);
    },

    eventMouseEnter: info => {
      const tip = document.createElement('div');
      tip.className = 'custom-tooltip';
      tip.innerHTML = `<strong>Usuarios:</strong><br>${(info.event.extendedProps.names||[]).join('<br>')}`;
      document.body.appendChild(tip);
      const move = e => { tip.style.left = `${e.pageX+10}px`; tip.style.top  = `${e.pageY+10}px`; };
      info.el.addEventListener('mousemove', move);
      info.el.addEventListener('mouseleave', () => tip.remove());
    },

    dayCellClassNames: arg => {
      const d = arg.date.getDay();
      if (d !== 5 && d !== 6) return ['disabled-day'];
    }
  });

  calendar.render();
}

/* ===== Asistencia ===== */
async function getReservasPorDia(day) {
  const snap = await getDocs(collection(db, 'asistencias', day, 'usuarios'));
  return snap.docs.map(d => ({
    uid: d.id,
    nombre: d.data().nombre,
    presente: d.data().presente || false
  }));
}

function abrirPopupAsistencia(list, day) {
  const popup = document.getElementById('asistenciaPopup');
  const ul    = document.getElementById('listaUsuarios');
  const fd    = document.getElementById('fechaReserva');
  if (!popup || !ul || !fd) return;

  ul.innerHTML = '';
  fd.textContent = day;

  list.forEach(u => {
    const li = document.createElement('li');
    li.className = 'asistencia-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = u.presente;
    cb.id = u.uid;
    cb.addEventListener('change', () => guardarAsistencia(day, u.uid, cb.checked));

    const span = document.createElement('span');
    span.textContent = u.nombre;

    li.append(cb, span);
    ul.append(li);
  });

  popup.classList.add('active');
}

async function guardarAsistencia(day, uid, presente) {
  try {
    await updateDoc(doc(db, 'asistencias', day, 'usuarios', uid), { presente });
    showAlert('Asistencia actualizada', 'success');
  } catch (err) {
    console.error(err);
    showAlert('Error al guardar asistencia', 'error');
  }
}

function cerrarPopup() {
  const popup = document.getElementById('asistenciaPopup');
  if (popup) popup.classList.remove('active');
}
