// ./js/role-guard.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// UID maestro (fallback de emergencia)
const MASTER_UID = "ScODWX8zq1ZXpzbbKk5vuHwSo7N2";

// Espera a auth listo
function waitForAuth() {
  return new Promise(resolve => {
    const off = onAuthStateChanged(auth, u => { off(); resolve(u); });
  });
}

// Lee roles del user doc (tolerante a errores)
async function readRoles(uid) {
  try {
    const s = await getDoc(doc(db, 'users', uid));
    return s.exists() ? (s.data().roles || []) : [];
  } catch (e) {
    console.warn('[guard] no pude leer roles:', e);
    return [];
  }
}

/** Requiere admin (rol "admin" o UID maestro). Redirige si no pasa. */
export async function requireAdmin({ redirectTo = './index.html' } = {}) {
  const user = await waitForAuth();
  if (!user) { location.href = redirectTo; throw new Error('no-auth'); }
  if (user.uid === MASTER_UID) return user;

  const roles = await readRoles(user.uid);
  if (roles.includes('admin')) return user;

  location.href = redirectTo;
  throw new Error('not-admin');
}

/** Requiere staff (admin o professor o maestro). */
export async function requireStaff({ redirectTo = './index.html' } = {}) {
  const user = await waitForAuth();
  if (!user) { location.href = redirectTo; throw new Error('no-auth'); }
  if (user.uid === MASTER_UID) return user;

  const roles = await readRoles(user.uid);
  if (roles.includes('admin') || roles.includes('professor')) return user;

  location.href = redirectTo;
  throw new Error('not-staff');
}

/** Devuelve {user, roles[]} sin redirigir (por si quieres decidir UI). */
export async function getCurrentUserAndRoles() {
  const user = await waitForAuth();
  const roles = user ? await readRoles(user.uid) : [];
  return { user, roles };
}
