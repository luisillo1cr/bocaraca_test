// ./js/control-mensualidades.js
import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';
import { gateAdmin } from './role-guard.js';

await gateAdmin({ onDeny: 'client-dashboard.html' });

let usersCache = [];
const $tbody  = () => document.querySelector('#mensualidades-table tbody');
const $filter = () => document.getElementById('filterState');
const $sort   = () => document.getElementById('sortBy');
const norm = s => (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

document.addEventListener('DOMContentLoaded', () => {
  setupSidebarToggle();

  onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = './index.html'; return; }

    document.getElementById('logoutSidebar')?.addEventListener('click', async e => {
      e.preventDefault();
      try { await signOut(auth); showAlert('Sesión cerrada','success'); setTimeout(()=>location.href='index.html', 1000); }
      catch { showAlert('Error al cerrar sesión', 'error'); }
    });

    await loadMensualidades();
    $filter()?.addEventListener('change', renderMensualidades);
    $sort()?.addEventListener('change', renderMensualidades);
  });
});

function setupSidebarToggle() {
  const btn = document.getElementById("toggleNav");
  const sb  = document.getElementById("sidebar");
  if (btn && sb) btn.addEventListener("click", () => sb.classList.toggle("active"));
}

function todayCRDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Costa_Rica' }));
}
function daysUntil(expiryDateStr) {
  if (!expiryDateStr) return -9999;
  const today = todayCRDate();
  const [y, m, d] = expiryDateStr.split('-').map(Number);
  const expiry = new Date(y, m - 1, d, 23, 59, 59);
  return Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
}
function getMembershipState(user) {
  if (!user.autorizado) return 'Vencida';
  const exp = user.expiryDate;
  if (!exp) return 'Vencida';
  const daysLeft = daysUntil(exp);
  if (daysLeft < 0)  return 'Vencida';
  if (daysLeft <= 5) return 'Próxima a vencer';
  return 'Activo';
}
function stateToClass(state) {
  switch (state) {
    case 'Vencida':           return 'state-vencida';
    case 'Próxima a vencer':  return 'state-proxima';
    case 'Activo':            return 'state-activo';
    default:                  return '';
  }
}

async function loadMensualidades() {
  const snap = await getDocs(collection(db, 'users'));
  usersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderMensualidades();
}
function renderMensualidades() {
  const tbody = $tbody();
  if (!tbody) return;
  tbody.innerHTML = '';

  const stateFilter = $filter()?.value || 'all';
  const order       = $sort()?.value   || 'az';

  let list = usersCache
    .map(u => ({ ...u, __state: getMembershipState(u) }))
    .filter(u => {
      if (stateFilter === 'activo')  return u.__state === 'Activo';
      if (stateFilter === 'proxima') return u.__state === 'Próxima a vencer';
      if (stateFilter === 'vencida') return u.__state === 'Vencida';
      return true;
    });

  list.sort((a, b) => {
    const an = norm(a.nombre), bn = norm(b.nombre);
    const cmp = an.localeCompare(bn);
    return order === 'za' ? -cmp : cmp;
  });

  const frag = document.createDocumentFragment();
  list.forEach(u => {
    const uid  = u.id;
    const exp  = u.expiryDate || '—';
    const st   = u.__state;
    const cls  = stateToClass(st);

    const tr = document.createElement('tr');
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
      <td class="${cls}">${st}</td>
      <td><input type="month" id="month-${uid}" value="${exp==='—' ? '' : exp.slice(0,7)}"></td>
      <td><button class="btnPay btn" data-uid="${uid}">Guardar</button></td>
    `;
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);

  tbody.onclick = async (e) => {
    const t = e.target;

    if (t.matches('input[type="checkbox"][data-uid]')) {
      const uid = t.getAttribute('data-uid');
      const checked = t.checked;
      try {
        await updateDoc(doc(db, 'users', uid), { autorizado: checked });
        showAlert('Autorización actualizada', 'success');
        await loadMensualidades();
      } catch {
        showAlert('Error al actualizar', 'error');
        t.checked = !checked;
      }
    }

    if (t.matches('.btnPay[data-uid]')) {
      const uid = t.getAttribute('data-uid');
      const monthVal = document.getElementById(`month-${uid}`)?.value || '';
      if (!monthVal) { showAlert('Selecciona un mes', 'error'); return; }
      const [y, m] = monthVal.split('-').map(Number);
      const lastDay = new Date(y, m, 0).toISOString().split('T')[0];
      try {
        await updateDoc(doc(db, 'users', uid), { expiryDate: lastDay, autorizado: true });
        showAlert('Pago registrado', 'success');
        await loadMensualidades();
      } catch { showAlert('Error al guardar pago', 'error'); }
    }
  };
}
