// ./js/usuarios.js
import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { setupInactivityTimeout } from './auth-timeout.js';
import { collection, query, where, updateDoc, doc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';
import { gateAdminPage } from './role-guard.js';

// Gate de roles (evita loops y páginas fantasma)
await gateAdminPage();

// ===== helpers de init seguro + navbar =====
const ready = (fn) =>
  (document.readyState === 'loading')
    ? document.addEventListener('DOMContentLoaded', fn, { once:true })
    : fn();

function ensureNavCSS(){
  if (document.getElementById('nav-fallback-css')) return;
  const style = document.createElement('style');
  style.id = 'nav-fallback-css';
  style.textContent = `
    .hamburger-btn{position:fixed;right:16px;top:16px;z-index:10001}
    .sidebar{position:fixed;inset:0 auto 0 0;width:260px;height:100vh;
             transform:translateX(-100%);transition:transform .25s ease;z-index:10000}
    .sidebar.active{transform:translateX(0)}
  `;
  document.head.appendChild(style);
}
function bindSidebarOnce(){
  const btn = document.getElementById('toggleNav');
  const sb  = document.getElementById('sidebar');
  if (!btn || !sb || btn.dataset.bound) return;
  btn.addEventListener('click', ()=> sb.classList.toggle('active'));
  btn.dataset.bound = '1';
}
function bindLogoutOnce(){
  const a = document.getElementById('logoutSidebar');
  if (!a || a.dataset.bound) return;
  a.addEventListener('click', async (e)=>{
    e.preventDefault();
    try {
      await signOut(auth);
      showAlert('Sesión cerrada','success');
      setTimeout(()=> location.href='index.html', 900);
    } catch {
      showAlert('Error al cerrar sesión','error');
    }
  });
  a.dataset.bound = '1';
}

// ===== estado UI =====
let usersCache = [];
const $tbody   = () => document.querySelector("#usuarios-table tbody");
const $filter  = () => document.getElementById("filterState");
const $sort    = () => document.getElementById("sortBy");

// NUEVO: referencias del buscador
const $search  = () => document.getElementById('searchText');
const $clear   = () => document.getElementById('clearSearch');

// utilidades
const norm = s => (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const debounce = (fn, ms=150) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

// ===== datos =====
function updateUserInCache(id, patch) {
  const i = usersCache.findIndex(u => u.id === id);
  if (i >= 0) usersCache[i] = { ...usersCache[i], ...patch };
}
async function generateUniqueCode() {
  const randomCode = () => Math.floor(1000 + Math.random() * 9000).toString();
  let code, exists = true;
  while (exists) {
    code = randomCode();
    const q = query(collection(db, 'users'), where('attendanceCode', '==', code));
    const snap = await getDocs(q);
    exists = !snap.empty;
  }
  return code;
}
async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));
  usersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderUsers();
}

function renderUsers() {
  const tbody = $tbody();
  if (!tbody) return;
  tbody.innerHTML = "";

  const state  = $filter()?.value || 'all'; // all | auth | noauth
  const order  = $sort()?.value   || 'az';  // az  | za

  // NUEVO: tokens de búsqueda
  const queryText = norm($search()?.value || '');
  const tokens    = queryText.split(/\s+/).filter(Boolean);

  // 1) filtrar por estado + búsqueda
  let list = usersCache.filter(u => {
    if (state === 'auth'   && !u.autorizado) return false;
    if (state === 'noauth' &&  u.autorizado) return false;

    if (tokens.length) {
      // Buscar por nombre, correo, cédula y código
      const hay = norm(`${u.nombre||''} ${u.correo||''} ${u.cedula||''} ${u.attendanceCode||''}`);
      if (!tokens.every(t => hay.includes(t))) return false;
    }
    return true;
  });

  // 2) ordenar
  list.sort((a,b)=>{
    const an = norm(a.nombre), bn = norm(b.nombre);
    const cmp = an.localeCompare(bn);
    return order === 'za' ? -cmp : cmp;
  });

  // 3) render
  list.forEach(u => {
    const tr  = document.createElement("tr");
    tr.id     = `row-${u.id}`;
    tr.innerHTML = `
      <td>${u.nombre ?? ''}</td>
      <td>${u.correo ?? ''}</td>
      <td>
        <label class="switch">
          <input type="checkbox" ${u.autorizado ? 'checked' : ''} data-id="${u.id}">
          <span class="slider round"></span>
        </label>
      </td>
      <td id="code-${u.id}">${u.attendanceCode || '—'}</td>
      <td><button class="btn code-btn" data-uid="${u.id}">🎲</button></td>
    `;
    tbody.appendChild(tr);

    // Toggle autorizado
    tr.querySelector("input[type='checkbox']").addEventListener("change", async e => {
      const checked = e.target.checked;
      try {
        await updateDoc(doc(db, "users", u.id), { autorizado: checked });
        updateUserInCache(u.id, {autorizado: checked});
        showAlert("Estado actualizado correctamente", "success");
        renderUsers();
      } catch {
        showAlert("No se pudo actualizar el estado.", "error");
        e.target.checked = !checked;
      }
    });

    // Botón para regenerar el código
    tr.querySelector('.code-btn').addEventListener('click', async () => {
      try {
        const newCode = await generateUniqueCode();
        await updateDoc(doc(db, 'users', u.id), { attendanceCode: newCode });
        updateUserInCache(u.id, { attendanceCode: newCode });
        const cell = document.getElementById(`code-${u.id}`);
        if (cell) cell.textContent = newCode;
        showAlert(`Código actualizado: ${newCode}`, "success");
      } catch (err) {
        console.error("Error generando attendanceCode:", err);
        showAlert("Error al generar el código.", "error");
      }
    });
  });
}

// ===== init =====
function init(){
  ensureNavCSS();
  bindSidebarOnce();
  bindLogoutOnce();
  setupInactivityTimeout?.();

  loadUsers().then(()=>{
    $filter()?.addEventListener('change', renderUsers);
    $sort()?.addEventListener('change', renderUsers);

    // NUEVO: búsqueda en vivo + botón limpiar
    const debounced = debounce(renderUsers, 150);
    $search()?.addEventListener('input', () => {
      if ($clear()) $clear().style.display = ($search().value ? 'inline-flex' : 'none');
      debounced();
    });
    $clear()?.addEventListener('click', () => {
      if ($search()) $search().value = '';
      if ($clear()) $clear().style.display = 'none';
      renderUsers();
    });
  });
}
ready(init);
