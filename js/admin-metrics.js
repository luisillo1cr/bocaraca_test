// ./js/admin-metrics.js
import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';
import { gateAdmin } from './role-guard.js';

// Gate único. Si no es admin → client-dashboard (evita loops)
await gateAdmin({ onDeny: 'client-dashboard.html' });

const crTZ = 'America/Costa_Rica';
const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: crTZ });
const monthsES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function monthsBetween(d1, d2){
  const y = d2.getFullYear() - d1.getFullYear();
  const m = d2.getMonth() - d1.getMonth();
  const total = y*12 + m + (d2.getDate() >= d1.getDate() ? 0 : -1);
  return Math.max(0,total);
}
function parseMaybeDate(v){
  if (!v) return null;
  if (typeof v === 'number') return new Date(v);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleNav');
  const sidebar = document.getElementById('sidebar');
  toggleBtn?.addEventListener('click', ()=> sidebar?.classList.toggle('active'));

  document.getElementById('logoutSidebar')?.addEventListener('click', async (e)=>{
    e.preventDefault();
    try { await signOut(auth); location.href='index.html'; } catch {}
  });

  const fmt = new Intl.DateTimeFormat('es-CR', {
    hour:'2-digit', minute:'2-digit', second:'2-digit', timeZone: crTZ
  });
  const last = document.getElementById('lastUpdate');
  if (last) last.textContent = `Actualizado: ${fmt.format(new Date())}`;
});

onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href='index.html'; return; }
  try { await buildMetrics(); }
  catch (e) {
    console.error(e);
    showAlert('No se pudieron cargar las métricas', 'error');
  }
});

/* ====== Charts cache ====== */
const charts = { signup: null, gender: null, age: null };
function destroyIfExists(key) { try { charts[key]?.destroy(); } catch {} charts[key] = null; }
function lockCanvasHeight(canvas, px){
  if (!canvas) return;
  try { canvas.style.setProperty('height', `${px}px`, 'important'); } catch {}
}

/* ====== Core: buildMetrics ====== */
async function buildMetrics(){
  const usersSnap = await getDocs(collection(db,'users'));
  const users = usersSnap.docs.map(d => ({ id:d.id, ...d.data() }));

  const total = users.length;
  const today = new Date(todayISO());

  let activos = 0, inactivos = 0;
  let nAdmins = 0, nProfes = 0, nStudents = 0;

  let sumMonths = 0, contMonths = 0;
  const year = new Date().getFullYear();
  const altasMes = Array(12).fill(0);

  const genderCount = { male:0, female:0, other:0, unknown:0 };
  const ageBuckets  = { '≤12':0, '13–17':0, '18–24':0, '25–34':0, '35–44':0, '45–54':0, '55–64':0, '65+':0 };
  let ageKnown = 0;

  for (const u of users) {
    const exp = parseMaybeDate(u.expiryDate || u.expira || u.expire || null);
    if (exp) (exp >= today ? activos++ : inactivos++); else inactivos++;

    const roles = Array.isArray(u.roles) ? u.roles : [];
    if (roles.includes('admin')) nAdmins++;
    if (roles.includes('professor')) nProfes++;
    if (roles.includes('student') || (!roles.includes('admin') && !roles.includes('professor'))) nStudents++;

    const created = parseMaybeDate(u.createdAt);
    if (created){
      sumMonths += monthsBetween(created, today);
      contMonths++;
      if (created.getFullYear() === year) altasMes[created.getMonth()]++;
    }

    const g = (u.genero || u.gender || '').toString().trim().toLowerCase();
    if (['m','male','masculino'].includes(g)) genderCount.male++;
    else if (['f','female','femenino'].includes(g)) genderCount.female++;
    else if (g) genderCount.other++; else genderCount.unknown++;

    const dob = parseMaybeDate(u.birthDate || u.dob || u.fechaNacimiento || u.nacimiento);
    if (dob){
      const age = Math.floor((today - dob) / (365.25*24*60*60*1000));
      ageKnown++;
      if (age <= 12) ageBuckets['≤12']++;
      else if (age <= 17) ageBuckets['13–17']++;
      else if (age <= 24) ageBuckets['18–24']++;
      else if (age <= 34) ageBuckets['25–34']++;
      else if (age <= 44) ageBuckets['35–44']++;
      else if (age <= 54) ageBuckets['45–54']++;
      else if (age <= 64) ageBuckets['55–64']++;
      else ageBuckets['65+']++;
    }
  }

  qs('#kpiTotal')?.replaceChildren(document.createTextNode(total));
  qs('#kpiActivos')?.replaceChildren(document.createTextNode(activos));
  qs('#kpiInactivos')?.replaceChildren(document.createTextNode(inactivos));
  qs('#kpiAdmins')?.replaceChildren(document.createTextNode(nAdmins));
  qs('#kpiProfes')?.replaceChildren(document.createTextNode(nProfes));
  qs('#kpiStudents')?.replaceChildren(document.createTextNode(nStudents));

  const ms30 = 30*24*60*60*1000;
  const now = Date.now();
  const nuevos30 = users.reduce((acc,u)=>{
    const c = parseMaybeDate(u.createdAt);
    return acc + (c && (now - c.getTime()) <= ms30 ? 1 : 0);
  }, 0);
  qs('#kpiNuevos')?.replaceChildren(document.createTextNode(nuevos30));

  const promMeses = contMonths ? (sumMonths/contMonths) : 0;
  qs('#kpiPermanencia')?.replaceChildren(document.createTextNode(promMeses.toFixed(1)));

  qs('#yearBadge')?.replaceChildren(document.createTextNode(year.toString()));
  drawSignupChart(altasMes);
  drawGenderChart(genderCount);
  drawAgeChart(ageBuckets, ageKnown);
}

/* ====== Charts ====== */
function drawSignupChart(series){
  const canvas = document.getElementById('signupChart');
  if (!canvas || typeof Chart === 'undefined') return;
  lockCanvasHeight(canvas, 180);
  destroyIfExists('signup');
  const ctx = canvas.getContext('2d');
  charts.signup = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthsES,
      datasets: [{ label: 'Altas', data: series, borderWidth: 2, tension: .25, pointRadius: 3 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 16/9,
      plugins: { legend: { display:false }, tooltip: { mode:'index', intersect:false } },
      interaction: { mode:'nearest', intersect:false },
      scales: { y: { beginAtZero:true, ticks:{ precision:0 } } }
    }
  });
}

function drawGenderChart(counts){
  const canvas = document.getElementById('genderChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const note = qs('#genderNote');
  if (note) note.textContent = counts.unknown ? `Sin dato: ${counts.unknown}` : '';
  lockCanvasHeight(canvas, 180);
  destroyIfExists('gender');
  const ctx = canvas.getContext('2d');
  charts.gender = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Masculino','Femenino','Otro'],
      datasets: [{ data: [counts.male, counts.female, counts.other] }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1.6,
      cutout: '65%',
      plugins: { legend: { position:'bottom' } }
    }
  });
}

function drawAgeChart(buckets, known){
  const canvas = document.getElementById('ageChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const labels = Object.keys(buckets);
  const data = labels.map(k => buckets[k]);
  const note = qs('#ageNote');
  if (note) note.textContent = known ? '' : 'Aún no hay fechas de nacimiento registradas.';
  lockCanvasHeight(canvas, 220);
  destroyIfExists('age');
  const ctx = canvas.getContext('2d');
  charts.age = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets:[{ label:'Usuarios', data, borderWidth:1 }]},
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 16/9,
      plugins: { legend: { display:false } },
      scales: { y: { beginAtZero:true, ticks:{ precision:0 } } }
    }
  });
}

/* ====== utils ====== */
function qs(sel){ return document.querySelector(sel); }
