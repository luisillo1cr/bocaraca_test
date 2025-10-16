// ./js/admin-events.js
import { auth, db, app } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import Cropper from 'https://cdn.jsdelivr.net/npm/cropperjs@1.5.13/dist/cropper.esm.js';
import { showAlert } from './showAlert.js';

import { gateAdmin } from './role-guard.js';
await gateAdmin(); // redirige a client-dashboard si no es admin


document.addEventListener('DOMContentLoaded', async () => {
  // Guard fuerte (evita loops: niega -> client-dashboard)
  const ok = await gateAdmin();
  if (!ok) return;

  // Sidebar toggle
  const toggleBtn = document.getElementById('toggleNav');
  const sidebar   = document.getElementById('sidebar');
  toggleBtn?.addEventListener('click', () => sidebar?.classList.toggle('active'));

  // Logout
  document.getElementById('logoutSidebar')?.addEventListener('click', async e => {
    e.preventDefault();
    try { await signOut(auth); showAlert('Has cerrado sesión','success'); setTimeout(()=>location.replace('index.html'), 900); }
    catch { showAlert('Error al cerrar sesión','error'); }
  });

  const form      = document.getElementById('eventForm');
  const tblBody   = document.getElementById('eventsTbody');
  const cancelBtn = document.getElementById('cancelBtn');
  if (!form || !tblBody || !cancelBtn) return;

  // === Cropper / Storage ===
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
    const canvas = cropper.getCroppedCanvas({ width: 500, height: 500 });
    canvas.toBlob(async blob => {
      try {
        const filename = `events/${Date.now()}_${rawFile.name}`;
        const ref = storageRef(storage, filename);
        await uploadBytes(ref, blob);
        const url = await getDownloadURL(ref);
        document.getElementById('imageUrl').value = url;
        showAlert('Imagen recortada y subida', 'success');
      } catch (err) {
        console.error(err); showAlert('Error al subir imagen', 'error');
      } finally {
        cropper?.destroy(); cropper = null; cropperModal.classList.remove('active');
      }
    }, rawFile.type);
  });

  // Quill
  const quill = new Quill('#descriptionEditor', {
    theme: 'snow',
    modules: { toolbar: [['bold','italic','underline','strike'],[{list:'ordered'},{list:'bullet'}],['link','image']] }
  });
  const hiddenDesc = document.getElementById('description');

  // Fechas bonitas
  function formatDateStr(dateStr){
    const [y,m,d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m-1, d);
    return new Intl.DateTimeFormat('es-CR',{weekday:'long',day:'numeric',month:'long'})
      .format(dt).replace(/^\w/, c=>c.toUpperCase());
  }

  let editingId = null;
  const fields = ['title','imageUrl','from','to','description','ticketsUrl'];

  // Crear/Actualizar
  form.addEventListener('submit', async e => {
    e.preventDefault();
    hiddenDesc.value = quill.root.innerHTML;
    const data = {
      title: document.getElementById('title').value.trim(),
      imageUrl: document.getElementById('imageUrl').value.trim(),
      from: document.getElementById('from').value,
      to: document.getElementById('to').value,
      description: hiddenDesc.value,
      ticketsUrl: document.getElementById('ticketsUrl').value.trim(),
      createdAt: Date.now()
    };
    try {
      if (editingId) {
        await updateDoc(doc(db,'events',editingId), data);
        showAlert('Evento actualizado','success');
      } else {
        await addDoc(collection(db,'events'), data);
        showAlert('Evento creado','success');
      }
      editingId = null; form.reset(); quill.setContents([]);
    } catch (err) { console.error(err); showAlert('Error guardando evento','error'); }
  });

  cancelBtn.addEventListener('click', () => { editingId = null; form.reset(); quill.setContents([]); });

  // Tabla RT
  onSnapshot(collection(db,'events'), snap => {
    tblBody.innerHTML = '';
    snap.forEach(s => {
      const e = s.data(), id = s.id;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${e.title||''}</td>
        <td><div class="date-range"><span>${formatDateStr(e.from)}</span><span class="arrow">→</span><span>${formatDateStr(e.to)}</span></div></td>
        <td>
          <button class="btn small" data-id="${id}" data-action="edit">✏️</button>
          <button class="btn small error" data-id="${id}" data-action="del">🗑️</button>
        </td>`;
      tblBody.appendChild(tr);
    });
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
      } catch (err) { console.error(err); showAlert('Error eliminando evento','error'); }
    }
  });
});
