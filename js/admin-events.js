// ./js/admin-events.js
import { auth, db, app } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, getDoc, serverTimestamp, orderBy, query
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import Cropper from 'https://cdn.jsdelivr.net/npm/cropperjs@1.5.13/dist/cropper.esm.js';
import { showAlert } from './showAlert.js';
import { gateAdminPage } from './role-guard.js';

/* ===== helpers DOM/nav (mismo patrón que ya usamos) ===== */
const ready = (fn)=>
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
    try { await signOut(auth); showAlert('Has cerrado sesión','success'); setTimeout(()=>location.href='index.html', 900); }
    catch { showAlert('Error al cerrar sesión','error'); }
  });
  a.dataset.bound = '1';
}

/* ===== init protegido NO bloqueante ===== */
ready(() => {
  ensureNavCSS();
  bindSidebarOnce();
  bindLogoutOnce();
  if (window.lucide) { try { window.lucide.createIcons(); } catch {} }

  // Gate sin frenar el shell (si no es admin, role-guard redirige)
  gateAdminPage()
    .then(initProtected)
    .catch(()=>{/* role-guard se encarga de redirigir */});
});

async function initProtected(){
  const form      = document.getElementById('eventForm');
  const tblBody   = document.getElementById('eventsTbody');
  const cancelBtn = document.getElementById('cancelBtn');
  if (!form || !tblBody || !cancelBtn) return;

  /* ====== Cropper/Storage ====== */
  const imageFileInput = document.getElementById('imageFile');
  const cropperModal   = document.getElementById('cropperModal');
  const cropperImage   = document.getElementById('cropperImage');
  const cropBtn        = document.getElementById('cropBtn');
  const cancelCropBtn  = document.getElementById('cancelCropBtn');
  let cropper = null, rawFile = null;
  const storage = getStorage(app);

  imageFileInput?.addEventListener('change', e => {
    const f = e.target.files?.[0]; if (!f) return;
    rawFile = f;
    cropperImage.src = URL.createObjectURL(f);
    cropperModal.classList.add('active');
    cropper?.destroy();
    cropper = new Cropper(cropperImage, { aspectRatio: 1, viewMode: 1, autoCropArea: 1 });
  });
  cancelCropBtn?.addEventListener('click', () => {
    cropper?.destroy(); cropper = null; cropperModal.classList.remove('active'); if (imageFileInput) imageFileInput.value = '';
  });
  cropBtn?.addEventListener('click', () => {
    if (!cropper || !rawFile) return;
    const canvas = cropper.getCroppedCanvas({ width: 800, height: 800 });
    canvas.toBlob(async blob => {
      try {
        const filename = `events/${Date.now()}_${(rawFile.name||'img').replace(/\s+/g,'_')}`;
        const ref = storageRef(storage, filename);
        await uploadBytes(ref, blob);
        const url = await getDownloadURL(ref);
        document.getElementById('imageUrl').value = url;
        showAlert('Imagen recortada y subida','success');
      } catch (err) {
        console.error(err);
        showAlert('Error al subir imagen','error');
      } finally {
        cropper?.destroy(); cropper=null; cropperModal.classList.remove('active');
      }
    }, rawFile.type || 'image/jpeg');
  });

  /* ====== Quill ====== */
  const quill = new Quill('#descriptionEditor', {
    theme: 'snow',
    modules: { toolbar: [['bold','italic','underline','strike'],[{list:'ordered'},{list:'bullet'}],['link','image']] }
  });
  const hiddenDesc = document.getElementById('description');

  const fields = ['title','imageUrl','from','to','description','ticketsUrl'];
  let editingId = null;

  /* ====== Crear/Actualizar ====== */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    hiddenDesc.value = quill.root.innerHTML;

    const data = {
      title: document.getElementById('title').value.trim(),
      imageUrl: document.getElementById('imageUrl').value.trim(),
      from: document.getElementById('from').value, // YYYY-MM-DD
      to: document.getElementById('to').value,
      description: hiddenDesc.value,
      ticketsUrl: document.getElementById('ticketsUrl').value.trim(),
      createdAt: serverTimestamp()
    };

    if (!data.title || !data.from || !data.to){
      showAlert('Completa título y fechas','error'); return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db,'events',editingId), data);
        showAlert('Evento actualizado','success');
      } else {
        await addDoc(collection(db,'events'), data);
        showAlert('Evento creado','success');
      }
      editingId = null; form.reset(); quill.setContents([]);
    } catch (err) {
      console.error('Error guardando evento:', err);
      showAlert('Error guardando evento (revisa reglas de Firestore)','error');
    }
  });

  cancelBtn.addEventListener('click', () => {
    editingId = null; form.reset(); quill.setContents([]);
  });

  /* ====== Tabla realtime ====== */
  const q = query(collection(db,'events'), orderBy('from','desc'));
  onSnapshot(q, snap => {
    tblBody.innerHTML = '';
    snap.forEach(s => {
      const e = s.data(), id = s.id;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${e.title||''}</td>
        <td>
          <div class="date-range">
            <span>${formatDateStr(e.from||'')}</span>
            <span class="arrow">→</span>
            <span>${formatDateStr(e.to||'')}</span>
          </div>
        </td>
        <td>
          <button class="btn small" data-id="${id}" data-action="edit">✏️</button>
          <button class="btn small error" data-id="${id}" data-action="del">🗑️</button>
        </td>`;
      tblBody.appendChild(tr);
    });
  }, err => {
    console.error('Snapshot error eventos:', err);
    showAlert('No se pudieron cargar los eventos','error');
  });

  // Delegación Edit/Del
  tblBody.addEventListener('click', async ev => {
    const btn = ev.target.closest('button'); if (!btn) return;
    const { id, action } = btn.dataset;
    if (action === 'edit') {
      const s = await getDoc(doc(db,'events',id));
      const data = s.data()||{};
      fields.forEach(f => {
        if (f==='description') quill.root.innerHTML = data.description || '';
        else { const el = document.getElementById(f); if (el && data[f]!==undefined) el.value = data[f]; }
      });
      editingId = id;
    } else if (action === 'del' && confirm('¿Eliminar este evento?')) {
      try {
        await deleteDoc(doc(db,'events',id));
        showAlert('Evento borrado','success');
        if (editingId===id){ editingId=null; form.reset(); quill.setContents([]); }
      } catch (err) {
        console.error(err);
        showAlert('Error eliminando evento (revisa reglas de Firestore)','error');
      }
    }
  });
}

/* ====== util ====== */
function formatDateStr(dateStr){
  if (!dateStr) return '—';
  const [y,m,d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m||1)-1, d||1);
  try {
    return new Intl.DateTimeFormat('es-CR',{weekday:'long',day:'numeric',month:'long'})
      .format(dt).replace(/^\w/, c=>c.toUpperCase());
  } catch { return dateStr; }
}
