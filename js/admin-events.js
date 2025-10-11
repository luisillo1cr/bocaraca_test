// ./js/admin-events.js
import { auth, db, app } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import Cropper from 'https://cdn.jsdelivr.net/npm/cropperjs@1.5.13/dist/cropper.esm.js';
import { showAlert } from './showAlert.js';

/* ========= Gate de administrador (UID maestro + rol admin) ========= */
const FIXED_ADMINS = new Set([
  "ScODWX8zq1ZXpzbbKk5vuHwSo7N2" // UID maestro
]);

async function getUserRoles(uid) {
  try {
    const s = await getDoc(doc(db, 'users', uid));
    return s.exists() ? (s.data().roles || []) : [];
  } catch { return []; }
}
async function requireAdmin(user) {
  if (!user) return false;
  if (FIXED_ADMINS.has(user.uid)) return true;
  const roles = await getUserRoles(user.uid);
  return roles.includes('admin');
}

/* ========= Utilidades ========= */
function formatDateStr(dateStr) {
  if (!dateStr) return '—';
  const [y,m,d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  const opts = { weekday:'long', day:'numeric', month:'long' };
  return new Intl.DateTimeFormat('es-CR', opts)
    .format(dt)
    .replace(/^\w/, c => c.toUpperCase());
}

/* ========= Estado local ========= */
let editingId = null;
const storage = getStorage(app);

document.addEventListener('DOMContentLoaded', () => {
  // 1) Sidebar toggle
  const toggleBtn = document.getElementById('toggleNav');
  const sidebar   = document.getElementById('sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => sidebar.classList.toggle('active'));
  }

  // 2) Logout desde sidebar
  const logoutSidebar = document.getElementById('logoutSidebar');
  if (logoutSidebar) {
    logoutSidebar.addEventListener('click', async e => {
      e.preventDefault();
      try {
        await signOut(auth);
        showAlert('Has cerrado sesión', 'success');
        setTimeout(() => window.location.href = 'index.html', 1200);
      } catch {
        showAlert('Error al cerrar sesión', 'error');
      }
    });
  }

  // 3) Seguridad: solo administradores (UID maestro o rol admin)
  onAuthStateChanged(auth, async user => {
    const ok = await requireAdmin(user);
    if (!ok) { window.location.href = './index.html'; return; }
    initEventsCRUD(); // levanta el CRUD sólo si pasó el gate
  });

  // Fallback por si cargan íconos
  if (window.lucide) window.lucide.createIcons();
});

/* ========= Inicializa todo el CRUD de eventos ========= */
function initEventsCRUD() {
  // 4) Capturar DOM del CRUD
  const form      = document.getElementById('eventForm');
  const tblBody   = document.getElementById('eventsTbody');
  const cancelBtn = document.getElementById('cancelBtn');
  const fields    = ['title','imageUrl','from','to','description','ticketsUrl'];

  if (!form || !tblBody || !cancelBtn) {
    console.error('Faltan elementos clave en el DOM de admin-events');
    return;
  }

  // --- CROP (imagen) ---
  const imageFileInput = document.getElementById('imageFile');
  const cropperModal   = document.getElementById('cropperModal');
  const cropperImage   = document.getElementById('cropperImage');
  const cropBtn        = document.getElementById('cropBtn');
  const cancelCropBtn  = document.getElementById('cancelCropBtn');
  let   cropper        = null;
  let   rawFile        = null;

  if (imageFileInput && cropperModal && cropperImage && cropBtn && cancelCropBtn) {
    imageFileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      rawFile = file;
      cropperImage.src = URL.createObjectURL(file);
      cropperModal.classList.add('active');
      if (cropper) cropper.destroy();
      cropper = new Cropper(cropperImage, {
        aspectRatio: 1,
        viewMode: 1,
        autoCropArea: 1
      });
    });

    cancelCropBtn.addEventListener('click', () => {
      if (cropper) cropper.destroy();
      cropper = null;
      cropperModal.classList.remove('active');
      imageFileInput.value = '';
    });

    cropBtn.addEventListener('click', () => {
      if (!cropper || !rawFile) return;
      const canvas = cropper.getCroppedCanvas({ width: 500, height: 500 });
      canvas.toBlob(async blob => {
        try {
          const filename = `events/${Date.now()}_${rawFile.name}`;
          const ref      = storageRef(storage, filename);
          await uploadBytes(ref, blob);
          const url = await getDownloadURL(ref);
          document.getElementById('imageUrl').value = url; // input oculto
          showAlert('Imagen recortada y subida','success');
        } catch (err) {
          console.error('Error subiendo imagen:', err);
          showAlert('Error al subir imagen','error');
        } finally {
          cropper.destroy();
          cropper = null;
          cropperModal.classList.remove('active');
        }
      }, rawFile.type);
    });
  }

  // --- Quill (descripción) ---
  if (typeof Quill === 'undefined') {
    console.warn('Quill no está cargado. El editor de descripción no se inicializará.');
  }
  const quill = typeof Quill !== 'undefined'
    ? new Quill('#descriptionEditor', {
        theme: 'snow',
        modules: {
          toolbar: [
            ['bold','italic','underline','strike'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['link','image']
          ]
        }
      })
    : null;
  const hiddenDesc = document.getElementById('description');

  // 5) Crear / actualizar evento
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (quill && hiddenDesc) hiddenDesc.value = quill.root.innerHTML;

    const data = {
      title:       document.getElementById('title').value.trim(),
      imageUrl:    document.getElementById('imageUrl').value.trim(),
      from:        document.getElementById('from').value,
      to:          document.getElementById('to').value,
      description: hiddenDesc ? hiddenDesc.value : (document.getElementById('description')?.value || ''),
      ticketsUrl:  document.getElementById('ticketsUrl').value.trim(),
      createdAt:   Date.now()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db,'events',editingId), data);
        showAlert('Evento actualizado','success');
      } else {
        await addDoc(collection(db,'events'), data);
        showAlert('Evento creado','success');
      }
      editingId = null;
      form.reset();
      if (quill) quill.setContents([]);
    } catch(err) {
      console.error('Error guardando evento:', err);
      showAlert('Error guardando evento','error');
    }
  });

  // 6) Cancelar edición
  cancelBtn.addEventListener('click', () => {
    editingId = null;
    form.reset();
    if (quill) quill.setContents([]);
  });

  // 7) Listar en tiempo real (ordenado por fecha desde el cliente)
  onSnapshot(collection(db,'events'), snap => {
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    rows.sort((a,b) => (a.from||'').localeCompare(b.from||''));
    tblBody.innerHTML = '';

    rows.forEach(e => {
      const fromFmt = formatDateStr(e.from);
      const toFmt   = formatDateStr(e.to);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${e.title || '—'}</td>
        <td>
          <div class="date-range">
            <span>${fromFmt}</span>
            <span class="arrow">→</span>
            <span>${toFmt}</span>
          </div>
        </td>
        <td>
          <button class="btn small" data-id="${e.id}" data-action="edit">✏️</button>
          <button class="btn small error" data-id="${e.id}" data-action="del">🗑️</button>
        </td>`;
      tblBody.appendChild(tr);
    });
  }, err => console.error('Snapshot error eventos:', err));

  // 8) Delegar botones Editar/Eliminar
  tblBody.addEventListener('click', async ev => {
    const btn = ev.target.closest('button');
    if (!btn || !btn.dataset.id) return;
    const { id, action } = btn.dataset;

    if (action === 'edit') {
      try {
        const snap = await getDoc(doc(db,'events',id));
        const data = snap.data() || {};
        ['title','imageUrl','from','to','ticketsUrl','description'].forEach(f => {
          if (f === 'description') {
            if (quill) quill.root.innerHTML = data.description || '';
            else {
              const descEl = document.getElementById('description');
              if (descEl) descEl.value = data.description || '';
            }
          } else {
            const el = document.getElementById(f);
            if (el && data[f] !== undefined) el.value = data[f];
          }
        });
        editingId = id;
      } catch (err) {
        console.error(err);
        showAlert('No se pudo cargar el evento', 'error');
      }
    }

    if (action === 'del' && confirm('¿Eliminar este evento?')) {
      try {
        await deleteDoc(doc(db,'events',id));
        showAlert('Evento eliminado','success');
        if (editingId === id) {
          editingId = null;
          form.reset();
          if (quill) quill.setContents([]);
        }
      } catch(err) {
        console.error('Error eliminando evento:', err);
        showAlert('Error eliminando evento','error');
      }
    }
  });
}

/* ========= Fallback global para toggle (por si el DOM cambió) ========= */
(function(){
  const t = document.getElementById('toggleNav');
  const s = document.getElementById('sidebar');
  if (t && s) t.addEventListener('click', () => s.classList.toggle('active'));
})();
