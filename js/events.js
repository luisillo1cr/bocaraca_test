// ./js/events.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, onSnapshot, orderBy, query, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const grid     = document.getElementById('eventsGrid');
const modal    = document.getElementById('eventModal');
const titleEl  = document.getElementById('modalTitle');
const imgEl    = document.getElementById('modalImg');
const datesEl  = document.getElementById('modalDates');
const descEl   = document.getElementById('modalDesc');
const linkEl   = document.getElementById('modalLink');
const closeBtn = document.getElementById('modalClose');

document.addEventListener('DOMContentLoaded', () => {
  // 1) Esperamos auth
  onAuthStateChanged(auth, async user => {
    console.log('📡 Auth user en events.js →', user);

    if (!user) {
      // no autenticado, redirige
      window.location.href = './index.html';
      return;
    }

    // 2) Comprobación rápida una sola vez
    try {
      const allSnap = await getDocs(collection(db, 'events'));
      console.log('📑 getDocs /events → IDs:', allSnap.docs.map(d => d.id));
    } catch (err) {
      console.error('❌ getDocs /events error:', err);
    }

    // 3) Listener en tiempo real
    const q = query(
      collection(db, 'events'),
      orderBy('startDate', 'asc')
    );

    onSnapshot(q, snap => {
      console.log('📂 onSnapshot /events docs:', snap.docs.map(d => d.id));
      grid.innerHTML = '';
      snap.docs.forEach(docSnap => {
        const e = docSnap.data();
        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
          <img src="${e.imageURL}" alt="${e.title}">
          <div class="info">
            <h3>${e.title}</h3>
            <p>${e.startDate} → ${e.endDate}</p>
          </div>
        `;
        card.addEventListener('click', () => openModal(e));
        grid.appendChild(card);
      });
    }, err => {
      console.error('❌ onSnapshot /events error:', err);
    });
  });
});

// 4) Modal detail
function openModal(e) {
  titleEl.textContent = e.title;
  imgEl.src           = e.imageURL;
  datesEl.textContent = `${e.startDate} → ${e.endDate}`;
  descEl.textContent  = e.description;
  linkEl.href         = e.ticketURL;
  modal.classList.add('active');
}

closeBtn.addEventListener('click', () => {
  modal.classList.remove('active');
});
