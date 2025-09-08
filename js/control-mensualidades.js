// ./js/control-mensualidades.js

import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection, getDocs, updateDoc, doc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';
import { confirmDialog } from './modal-utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupSidebarToggle();
  setupAuth();
  ensureToolbar();          // ← filtro + orden
  loadMensualidades();      // ← render inicial
});

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar toggle
// ─────────────────────────────────────────────────────────────────────────────
function setupSidebarToggle() {
  const btn = document.getElementById("toggleNav");
  const sb  = document.getElementById("sidebar");
  if (btn && sb) btn.addEventListener("click", () => sb.classList.toggle("active"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth + logout
// ─────────────────────────────────────────────────────────────────────────────
function setupAuth() {
  onAuthStateChanged(auth, user => {
    const ADMINS = ["TWAkND9zF0UKdMzswAPkgas9zfL2","ScODWX8zq1ZXpzbbKk5vuHwSo7N2"];
    if (!user || !ADMINS.includes(user.uid)) window.location.href = './index.html';
  });
  const logoutBtn = document.getElementById('logoutSidebar');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async e => {
      e.preventDefault();
      await signOut(auth);
      showAlert('Sesión cerrada', 'success');
      setTimeout(() => window.location.href = 'index.html', 1000);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FECHAS y estado de membresía
// ─────────────────────────────────────────────────────────────────────────────
function todayCRDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Costa_Rica' }));
}
function daysUntil(yyyymmdd) {
  const t = todayCRDate();
  const [y,m,d] = yyyymmdd.split('-').map(Number);
  const exp = new Date(y, m-1, d);
  return Math.floor((exp - t) / 86400000);
}
function getMembershipState(u) {
  if (!u.autorizado) return 'Vencida';
  const exp = u.expiryDate;
  if (!exp) return 'Vencida';
  const left = daysUntil(exp);
  if (left < 0) return 'Vencida';
  if (left <= 5) return 'Próxima a vencer';
  return 'Activo';
}
function stateToClass(s) {
  return s === 'Vencida' ? 'state-vencida'
       : s === 'Próxima a vencer' ? 'state-proxima'
       : s === 'Activo' ? 'state-activo' : '';
}

// ─────────────────────────────────────────────────────────────────────────────
/**  Modal Bootstrap “confirmar” como Promesa  */
function bsConfirm({ title='Confirmar', message='¿Deseas continuar?', okText='Confirmar', okVariant='danger' } = {}) {
  return new Promise(resolve => {
    const mEl = document.getElementById('confirmModal');
    const modal = new bootstrap.Modal(mEl);
    mEl.querySelector('#confirmTitle').textContent = title;
    mEl.querySelector('#confirmMessage').textContent = message;
    const okBtn = mEl.querySelector('#confirmOkBtn');
    okBtn.className = `btn btn-${okVariant}`;
    okBtn.textContent = okText;

    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    const cleanup = () => {
      okBtn.removeEventListener('click', onOk);
      mEl.removeEventListener('hidden.bs.modal', onCancel);
    };

    okBtn.addEventListener('click', onOk);
    mEl.addEventListener('hidden.bs.modal', onCancel, { once: true });
    modal.show();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Barra de filtro y orden
// ─────────────────────────────────────────────────────────────────────────────
let filterSel = null;
let sortSel   = null;

function ensureToolbar() {
  const card = document.querySelector('.calendar-wrapper .card') || document.body;
  const container = card.querySelector('.table-container') || card;

  // evita duplicar si ya existe
  if (card.querySelector('#mensuToolbar')) {
    filterSel = card.querySelector('#mensuFilter');
    sortSel   = card.querySelector('#mensuSort');
    return;
  }

  const bar = document.createElement('div');
  bar.id = 'mensuToolbar';
  bar.className = 'd-flex flex-wrap gap-2 justify-content-between align-items-center mb-2';

  bar.innerHTML = `
    <div class="fw-semibold text-secondary">Filtrar y ordenar</div>
    <div class="d-flex gap-2">
      <select id="mensuFilter" class="form-select form-select-sm bg-dark text-light border-secondary" style="min-width:180px">
        <option value="all">Todas</option>
        <option value="activo">Activa</option>
        <option value="vencida">Vencida</option>
        <option value="proxima">Próxima a vencer</option>
      </select>
      <select id="mensuSort" class="form-select form-select-sm bg-dark text-light border-secondary" style="min-width:180px">
        <option value="nameAZ">Nombre A–Z</option>
        <option value="nameZA">Nombre Z–A</option>
      </select>
    </div>
  `;
  card.insertBefore(bar, container);

  filterSel = bar.querySelector('#mensuFilter');
  sortSel   = bar.querySelector('#mensuSort');

  filterSel.addEventListener('change', applyFilterSort);
  sortSel.addEventListener('change', applyFilterSort);
}

function applyFilterSort() {
  const tbody = document.querySelector('#mensualidades-table tbody');
  if (!tbody) return;
  const rows = [...tbody.querySelectorAll('tr')];

  // orden (alfabético por nombre)
  rows.sort((a,b)=>{
    const A = (a.dataset.name || '').localeCompare(b.dataset.name || '', 'es', {sensitivity:'base'});
    return (sortSel.value === 'nameAZ') ? A : -A;
  });

  // filtro por estado
  const filter = filterSel.value; // all | activo | vencida | proxima
  rows.forEach(r => {
    const st = r.dataset.state || '';
    const show = (filter === 'all') || (st === filter);
    r.style.display = show ? '' : 'none';
  });

  tbody.replaceChildren(...rows);
}

// ─────────────────────────────────────────────────────────────────────────────
// Render mensualidades
// ─────────────────────────────────────────────────────────────────────────────
async function loadMensualidades() {
  const tbody = document.querySelector('#mensualidades-table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  const snap = await getDocs(collection(db, 'users'));
  snap.forEach(d => {
    const u   = d.data();
    const uid = d.id;

    const stateStr = getMembershipState(u);               // 'Activo' | 'Vencida' | 'Próxima a vencer'
    const stateKey = stateStr === 'Activo' ? 'activo'
                    : stateStr === 'Vencida' ? 'vencida' : 'proxima';
    const exp      = u.expiryDate || '—';

    const tr = document.createElement('tr');
    tr.dataset.name  = (u.nombre || '').toLowerCase();
    tr.dataset.state = stateKey;

    tr.innerHTML = `
      <td>${u.nombre || ''}</td>
      <td>${u.correo || ''}</td>
      <td>
        <label class="switch">
          <input type="checkbox" ${u.autorizado ? 'checked' : ''} data-uid="${uid}">
          <span class="slider round"></span>
        </label>
      </td>
      <td>${exp}</td>
      <td class="${stateToClass(stateStr)}">${stateStr}</td>
      <td>
        <input type="month" id="month-${uid}" value="${exp==='—' ? '' : exp.slice(0,7)}">
      </td>
      <td>
        <button class="btn btn-sm btn-success btnPay" data-uid="${uid}">
          <i class="bi bi-floppy"></i> Guardar
        </button>
      </td>
    `;
    tbody.appendChild(tr);

    // Cambiar "autorizado" (con confirmación)
    tr.querySelector('input[type=checkbox]').addEventListener('change', async e => {
      const checked = e.target.checked;
      const ok = await bsConfirm({
        title: 'Confirmar cambio',
        message: checked
          ? '¿Autorizar a este usuario?'
          : '¿Quitar la autorización de este usuario?',
        okText: 'Sí, continuar',
        okVariant: 'primary'
      });
      if (!ok) { e.target.checked = !checked; return; }

      try {
        await updateDoc(doc(db,'users', uid), { autorizado: checked });
        showAlert('Autorización actualizada','success');
        loadMensualidades();
      } catch {
        showAlert('Error al actualizar','error');
        e.target.checked = !checked;
      }
    });

    // Guardar pago (con confirmación)
    tr.querySelector('.btnPay').addEventListener('click', async () => {
      const monthVal = document.getElementById(`month-${uid}`).value;
      if (!monthVal) { showAlert('Selecciona un mes','error'); return; }

      const [y,m] = monthVal.split('-').map(Number);
      const lastDay = new Date(y, m, 0).toISOString().split('T')[0];

      const ok = await bsConfirm({
        title: 'Registrar pago',
        message: `Se establecerá la fecha de expiración en ${lastDay} y se autorizará al usuario.`,
        okText: 'Registrar',
        okVariant: 'success'
      });
      if (!ok) return;

      try {
        await updateDoc(doc(db,'users', uid), { expiryDate:lastDay, autorizado:true });
        showAlert('Pago registrado','success');
        loadMensualidades();
      } catch {
        showAlert('Error al guardar pago','error');
      }
    });
  });

  applyFilterSort(); // respeta selección actual
}
