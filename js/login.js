// ./js/login.js
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

/* ===== Debug / Trace ===== */
const DEBUG = new URLSearchParams(location.search).get('debugAuth') === '1'
           || localStorage.getItem('DEBUG_AUTH') === '1'
           || sessionStorage.getItem('DEBUG_AUTH') === '1';
function log(...a){ if (DEBUG) console.log('[AUTH/LOGIN]', ...a); }
function pushTrace(step, data={}){
  try{
    const arr = JSON.parse(localStorage.getItem('AUTH_TRACE')||'[]');
    arr.push({ t:new Date().toISOString(), page: location.pathname, step, data });
    if (arr.length>60) arr.shift();
    localStorage.setItem('AUTH_TRACE', JSON.stringify(arr));
  }catch{}
}
if (DEBUG) setTimeout(()=>{ try{
  const arr = JSON.parse(localStorage.getItem('AUTH_TRACE')||'[]');
  console.groupCollapsed('[AUTH] TRACE (persistente)'); arr.forEach((r,i)=>console.log(i,r)); console.groupEnd();
}catch{} },0);

/* Loader global si lo tienes */
function showLoader(){ try{ window.showLoader?.(); }catch{} }
function hideLoader(){ try{ window.hideLoader?.(); }catch{} }

const loginForm      = document.getElementById('loginForm');
const emailInput     = document.getElementById('email');
const passwordInput  = document.getElementById('password');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');

let failedAttempts = Number(localStorage.getItem('failedAttempts') || 0);
if (failedAttempts >= 3 && forgotPasswordLink) forgotPasswordLink.style.display = 'block';

let didRoute = false;

async function ensureUserDoc(uid, email){
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()){
    const payload = { uid, correo: email||'', createdAt: new Date().toISOString(), roles:['student'], autorizado:false };
    pushTrace('ensureUserDoc_create', payload);
    await setDoc(ref, payload);
  } else {
    pushTrace('ensureUserDoc_exists', { uid });
  }
}
async function getRoles(uid){
  const s = await getDoc(doc(db,'users',uid));
  const roles = s.exists() ? (s.data().roles||[]) : [];
  pushTrace('roles_on_login', { roles });
  return roles;
}

async function routeByRole(user){
  if (!user) return;
  if (didRoute){ pushTrace('route_skip_already'); return; }
  didRoute = true;

  try{
    showLoader();
    pushTrace('route_start', { uid:user.uid });

    await ensureUserDoc(user.uid, user.email);
    await user.getIdToken(true);
    pushTrace('token_refreshed');

    const roles = await getRoles(user.uid);
    const target = roles.includes('admin') ? 'admin-dashboard.html' : 'client-dashboard.html';
    pushTrace('route_decision', { roles, target });

    // Delay mínimo para que la traza se escriba antes de navegar
    setTimeout(()=> window.location.replace(target), 50);
  }catch(ex){
    pushTrace('route_error', { err:String(ex) });
    showAlert('No se pudo cargar tu perfil. Intenta de nuevo.', 'error');
    didRoute = false;
  }finally{ hideLoader(); }
}

onAuthStateChanged(auth, (user)=>{
  pushTrace('login_onAuth', { uid: user?.uid || null });
  if (user) routeByRole(user);
});

loginForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = (emailInput?.value||'').trim();
  const pass  = (passwordInput?.value||'').trim();
  if (!email || !pass){ showAlert('Ingresa correo y contraseña','error'); return; }
  try{
    showLoader();
    pushTrace('signin_start', { email });
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    pushTrace('signin_ok', { uid: cred.user.uid });
    localStorage.setItem('failedAttempts','0');
    await routeByRole(cred.user);
  }catch(ex){
    pushTrace('signin_error', { code: ex.code, msg: ex.message });
    showAlert(`Error: ${ex.code}`, 'error');
    const n = (Number(localStorage.getItem('failedAttempts')||0) + 1);
    localStorage.setItem('failedAttempts', String(n));
    if (n >= 3 && forgotPasswordLink) forgotPasswordLink.style.display = 'block';
  }finally{ hideLoader(); }
});
