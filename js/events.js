// ./js/events.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection,
  getDocs,
  onSnapshot,
  query, where, orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// formateador fallback “día mes año”
const dateFmt = new Intl.DateTimeFormat('es-CR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

/**
 * Rango entre dos YYYY-MM-DD:
 * - mismo mes → “18–19 julio 2025”
 * - distinto mes/año → “1 de mayo de 2025 – 31 de julio de 2025”
 */
function formatRange(start, end) {
  const [y1, m1, d1] = (start || '').split('-').map(Number);
  const [y2, m2, d2] = (end   || '').split('-').map(Number);
  if (!y1 || !y2) return '';
  const dt1 = new Date(y1, m1 - 1, d1);
  const dt2 = new Date(y2, m2 - 1, d2);

  if (dt1.getMonth() === dt2.getMonth() && dt1.getFullYear() === dt2.getFullYear()) {
    const my = dt1.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' });
    return `${dt1.getDate()}–${dt2.getDate()} ${my}`;
  }
  return `${dateFmt.format(dt1)} – ${dateFmt.format(dt2)}`;
}

// referencias DOM
const grid     = document.getElementById('eventsGrid');
const modal    = document.getElementById('eventModal');
const titleEl  = document.getElementById('modalTitle');
const imgEl    = document.getElementById('modalImg');
const datesEl  = document.getElementById('modalDates');
const descEl   = document.getElementById('modalDesc');
const linkEl   = document.getElementById('modalLink');
const closeBtn = document.getElementById('modalClose');
const closeX   = document.getElementById('modalCloseX');

/** Dibuja tarjetas en el grid */
function renderEvents(docs) {
  if (!grid) return;
  grid.innerHTML = '';
  docs.forEach(docSnap => {
    const e       = docSnap.data();
    const imgSrc  = e.imageURL ?? e.imageUrl ?? '';
    const start   = e.startDate ?? e.from ?? '';
    const end     = e.endDate   ?? e.to ?? '';
    const title   = e.title      ?? '';
    const desc    = e.description ?? '';
    const ticket  = e.ticketURL  ?? e.ticketsUrl ?? '';

    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <img src="${imgSrc}" alt="${title}">
      <div class="info">
        <h3>${title}</h3>
        <p>${start && end ? formatRange(start, end) : ''}</p>
      </div>`;
    card.addEventListener('click', () => openModal({ title, imgSrc, start, end, desc, ticket }));
    grid.appendChild(card);
  });
}

// Modal
function openModal({ title, imgSrc, start, end, desc, ticket }) {
  if (!modal) return;
  titleEl.textContent = title || '';
  imgEl.src = imgSrc || '';
  imgEl.onclick = () => imgSrc && window.open(imgSrc, '_blank');
  datesEl.textContent = start && end ? formatRange(start, end) : '';
  descEl.innerHTML = desc || '';
  linkEl.onclick = e => {
    if (!ticket) {
      e.preventDefault();
      linkEl.classList.add('shake');
      setTimeout(() => linkEl.classList.remove('shake'), 500);
    } else {
      window.open(ticket, '_blank');
    }
  };
  modal.classList.add('active');
}
closeBtn?.addEventListener('click', () => modal?.classList.remove('active'));
closeX  ?.addEventListener('click', () => modal?.classList.remove('active'));

// ---------- Auth gate + lecturas (¡aquí está el fix!) ----------
let unsubscribe = null;

document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, async (user) => {
    // si no hay usuario, redirige y NO inicies lecturas (evita permission-denied)
    if (!user) { window.location.href = './index.html'; return; }

    // 1) Carga inicial (opcional)
    try {
      // si tienes flags, puedes filtrar con where('active','==',true)
      const qInit = query(collection(db, 'events'), orderBy('startDate', 'asc'));
      const snap  = await getDocs(qInit);
      renderEvents(snap.docs);
    } catch (err) {
      console.error('Error getDocs(/events):', err);
    }

    // 2) Live updates (solo una suscripción activa)
    if (typeof unsubscribe === 'function') { try { unsubscribe(); } catch {} }
    const qLive = query(collection(db, 'events'), orderBy('startDate', 'asc'));
    unsubscribe = onSnapshot(qLive,
      (snap) => renderEvents(snap.docs),
      (err)  => console.error('onSnapshot(/events) error:', err)
    );
  });
});
