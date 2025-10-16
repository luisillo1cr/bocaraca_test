// ./js/role-guard.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* ===== Debug / Trace ===== */
function debugEnabled(){
  const q = new URLSearchParams(location.search);
  return q.get('debugAuth') === '1'
      || localStorage.getItem('DEBUG_AUTH') === '1'
      || sessionStorage.getItem('DEBUG_AUTH') === '1';
}
function log(...a){ if (debugEnabled()) console.log('[AUTH/GUARD]', ...a); }
function warn(...a){ if (debugEnabled()) console.warn('[AUTH/GUARD]', ...a); }
function err(...a){ console.error('[AUTH/GUARD]', ...a); }

/* Traza que PERSISTE entre páginas */
function pushTrace(step, data={}){
  try{
    const arr = JSON.parse(localStorage.getItem('AUTH_TRACE')||'[]');
    arr.push({ t: new Date().toISOString(), page: location.pathname, step, data });
    if (arr.length > 60) arr.shift();
    localStorage.setItem('AUTH_TRACE', JSON.stringify(arr));
  }catch{}
}
function dumpTrace(clear=true){
  try{
    const arr = JSON.parse(localStorage.getItem('AUTH_TRACE')||'[]');
    console.groupCollapsed('[AUTH] TRACE (persistente)');
    arr.forEach((row,i)=>console.log(i, row));
    console.groupEnd();
    if (clear) localStorage.removeItem('AUTH_TRACE');
  }catch{}
}
if (debugEnabled()) setTimeout(()=>dumpTrace(false), 0);
window.__dumpAuthTrace = dumpTrace;

/* ===== Roles cache ===== */
function cacheRoles(uid, roles){ try{ sessionStorage.setItem('roles:'+uid, JSON.stringify(roles||[])); }catch{} }
function readCachedRoles(uid){
  try{ const raw = sessionStorage.getItem('roles:'+uid); return raw ? JSON.parse(raw) : null; }catch{ return null; }
}

/* ===== Core helpers ===== */
export function waitForUser(){
  return new Promise(resolve=>{
    const unsub = onAuthStateChanged(auth, u=>{
      unsub();
      log('onAuthStateChanged:', u ? `uid=${u.uid}` : 'null');
      pushTrace('onAuthStateChanged', { uid: u?.uid || null });
      resolve(u || null);
    });
  });
}

export async function getMyRoles(uid, { force=true } = {}){
  if (!uid) return [];
  if (!force){
    const cached = readCachedRoles(uid);
    if (cached){ log('getMyRoles cached', cached); pushTrace('roles_cached', { roles: cached }); return cached; }
  }
  try{
    const s = await getDoc(doc(db,'users', uid));
    const roles = s.exists() ? (Array.isArray(s.data().roles)?s.data().roles:[]) : [];
    cacheRoles(uid, roles);
    log('getMyRoles fetched', roles);
    pushTrace('roles_fetched', { roles });
    return roles;
  }catch(ex){
    warn('getMyRoles failed', ex);
    const cached = readCachedRoles(uid) || [];
    pushTrace('roles_error_cached', { roles: cached, err: String(ex) });
    return cached;
  }
}

/* ===== Gates ===== */
export async function gateAdmin({ onDeny='client-dashboard.html' } = {}){
  pushTrace('gateAdmin_start');
  const user = await waitForUser();
  if (!user){ pushTrace('gateAdmin_nouser'); location.href='index.html'; return false; }

  try{ await user.getIdToken(true); pushTrace('gateAdmin_token_refreshed'); }catch(ex){ warn('token refresh', ex); }

  const roles = await getMyRoles(user.uid, { force:true });
  const ok = roles.includes('admin');
  pushTrace('gateAdmin_eval', { roles, ok });

  if (!ok){ pushTrace('gateAdmin_redirect_deny', { to:onDeny }); location.href = onDeny; return false; }
  pushTrace('gateAdmin_ok');
  return true;
}

export async function gateStaff({ onDeny='client-dashboard.html' } = {}){
  pushTrace('gateStaff_start');
  const user = await waitForUser();
  if (!user){ pushTrace('gateStaff_nouser'); location.href='index.html'; return false; }

  try{ await user.getIdToken(true); pushTrace('gateStaff_token_refreshed'); }catch(ex){ warn('token refresh', ex); }

  const roles = await getMyRoles(user.uid, { force:true });
  const ok = roles.includes('admin') || roles.includes('professor');
  pushTrace('gateStaff_eval', { roles, ok });

  if (!ok){ pushTrace('gateStaff_redirect_deny', { to:onDeny }); location.href = onDeny; return false; }
  pushTrace('gateStaff_ok');
  return true;
}

/* Decide landing post login, por si lo necesitas */
export async function decideLanding(){
  pushTrace('decideLanding_start');
  const user = await waitForUser();
  if (!user){ pushTrace('decideLanding_nouser'); return 'index.html'; }
  try{ await user.getIdToken(true); pushTrace('decideLanding_token_refreshed'); }catch{}
  const roles = await getMyRoles(user.uid, { force:true });
  const to = roles.includes('admin') ? 'admin-dashboard.html' : 'client-dashboard.html';
  pushTrace('decideLanding_choice', { roles, to });
  return to;
}
