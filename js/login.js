// ./js/login.js
import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

// ---- helpers ----------------------------------------------------
async function ensureUserDoc(uid, email) {
  // Si no existe, créalo con el mínimo permitido por tus reglas:
  // roles == ["student"], createdAt string, uid == auth.uid
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid,
      createdAt: new Date().toISOString(),
      roles: ['student'],
      correo: email ?? ''
    }, { merge: true });
  }
  return (await getDoc(ref)).data();
}

async function routeByRole(user) {
  try {
    const data = await ensureUserDoc(user.uid, user.email || '');
    const roles = Array.isArray(data?.roles) ? data.roles : [];

    // Admin ⇒ admin-dashboard, de lo contrario ⇒ client-dashboard
    if (roles.includes('admin')) {
      window.location.href = './admin-dashboard.html';
    } else {
      window.location.href = './client-dashboard.html';
    }
  } catch (err) {
    console.error('routeByRole error:', err);
    showAlert('No fue posible cargar tu perfil. Intenta de nuevo.', 'error');
  }
}

// ---- UI & login -------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');

  // Si ya está autenticado, enruta por rol
  onAuthStateChanged(auth, (user) => {
    if (user) routeByRole(user);
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('email')?.value || '').trim();
    const pass  = (document.getElementById('password')?.value || '').trim();
    if (!email || !pass) {
      showAlert('Completa correo y contraseña', 'error');
      return;
    }
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, pass);
      showAlert('Sesión iniciada', 'success');
      await routeByRole(user); // ← aquí se decide la página
    } catch (err) {
      console.error(err);
      showAlert('Credenciales inválidas', 'error');
    }
  });
});
