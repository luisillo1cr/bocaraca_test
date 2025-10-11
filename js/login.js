// ./js/login.js — Redirección por rol (sin whitelist de correos)
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

// UID maestro (sigue teniendo acceso aunque algo falle leyendo roles)
const FIXED_ADMIN_UIDS = ["ScODWX8zq1ZXpzbbKk5vuHwSo7N2"];

// UI
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');

// Intentos fallidos -> mostrar enlace de “olvidé mi contraseña”
let failedAttempts = parseInt(localStorage.getItem('failedAttempts')) || 0;
forgotPasswordLink.style.display = failedAttempts >= 3 ? 'block' : 'none';

// Helpers
async function getUserRoles(uid) {
  try {
    const s = await getDoc(doc(db, 'users', uid));
    return s.exists() ? (s.data().roles || []) : [];
  } catch (e) {
    console.error('[login] getUserRoles error:', e);
    return [];
  }
}

function routeByRoles(uid, roles) {
  const isAdmin = FIXED_ADMIN_UIDS.includes(uid) || roles.includes('admin');
  // Profesores van al dashboard de cliente (ahí tienen el calendario de profesor)
  const target = isAdmin ? './admin-dashboard.html' : './client-dashboard.html';
  window.location.replace(target);
}

// Si ya está logueado y entra a index.html, ruteamos automáticamente
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    const roles = await getUserRoles(user.uid);
    routeByRoles(user.uid, roles);
  } catch (e) {
    // Si fallara leer roles, el UID maestro igual entra al admin
    if (FIXED_ADMIN_UIDS.includes(user.uid)) {
      window.location.replace('./admin-dashboard.html');
    }
  }
});

// Submit del login
loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = (emailInput?.value || '').trim();
  const password = passwordInput?.value || '';

  if (!email || !password) {
    showAlert("Por favor, ingrese un correo electrónico y una contraseña.", 'error');
    return;
  }

  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    if (!user) {
      showAlert("Error: No se pudo iniciar sesión correctamente.", 'error');
      return;
    }

    showAlert("¡Bienvenido! 👍", 'success');
    localStorage.setItem('failedAttempts', 0);

    // Obtenemos roles y redirigimos por rol
    const roles = await getUserRoles(user.uid);
    // pequeño delay solo para que el toast se vea; opcional
    setTimeout(() => routeByRoles(user.uid, roles), 600);

  } catch (error) {
    console.error('Error al iniciar sesión:', error.code, error.message);
    showAlert(`Error: ${error.code} - ${error.message}`, 'error');

    // Contador de intentos fallidos
    failedAttempts++;
    localStorage.setItem('failedAttempts', failedAttempts);
    if (failedAttempts >= 3) {
      forgotPasswordLink.style.display = 'block';
    }
  }
});
