// ./js/_admin-auth.js
import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export const MASTER_UID = "ScODWX8zq1ZXpzbbKk5vuHwSo7N2"; // único fallback

export async function getUserRoles(uid) {
  try {
    const s = await getDoc(doc(db, 'users', uid));
    return s.exists() ? (Array.isArray(s.data().roles) ? s.data().roles : []) : [];
  } catch {
    return [];
  }
}

export async function requireAdmin(user) {
  if (!user) return false;
  if (user.uid === MASTER_UID) return true;
  const roles = await getUserRoles(user.uid);
  return roles.includes('admin');
}

export async function requireAdminOrProfessor(user) {
  if (!user) return false;
  if (user.uid === MASTER_UID) return true;
  const roles = await getUserRoles(user.uid);
  return roles.includes('admin') || roles.includes('professor');
}
