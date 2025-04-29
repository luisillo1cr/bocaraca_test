import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, query, where, onSnapshot, getDocs, updateDoc,doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

document.addEventListener('DOMContentLoaded', function () {
  const calendarEl = document.getElementById('calendar');

  const calendar = new FullCalendar.Calendar(calendarEl, {
    locale: 'es',
    initialView: window.innerWidth < 768 ? 'listWeek' : 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,dayGridWeek,dayGridDay'
    },

    events: function (info, successCallback, failureCallback) {
      const reservasRef = collection(db, 'reservations');

      onSnapshot(reservasRef, (querySnapshot) => {
        const dateCounts = {};

        querySnapshot.forEach(doc => {
          const data = doc.data();
          const date = data.date;

          if (date) {
            if (!dateCounts[date]) {
              dateCounts[date] = 0;
            }
            dateCounts[date]++;
          }
        });

        const events = Object.keys(dateCounts).map(date => ({
          title: `${dateCounts[date]}`,
          start: date,
          allDay: true
        }));

        successCallback(events);
      }, (error) => {
        console.error('Error al obtener las reservas:', error);
        failureCallback(error);
      });
    },

    eventClick: function(info) {
      info.jsEvent.preventDefault();
    },

    dayCellClassNames: function(arg) {
      const day = arg.date.getDay();
      if (day !== 5 && day !== 6) {
        return ['disabled-day'];
      }
    }
  });

  calendar.render();
  loadUsers(); // cargar usuarios al iniciar
});

const logoutBtn = document.getElementById('logoutBtn');
logoutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
    showAlert("Has cerrado sesión", 'success');
    setTimeout(() => {
      window.location.href = "./index.html";
    }, 1500);
  } catch (error) {
    console.error('Error al cerrar sesión:', error.message);
    showAlert('Hubo un problema al cerrar sesión.', 'error');
  }
});

// ---------- AUTORIZACIÓN DE USUARIOS DESDE EL PANEL ----------

async function loadUsers() {
  const userListDiv = document.getElementById('userList');
  if (!userListDiv) return;

  userListDiv.innerHTML = '<p>Cargando usuarios...</p>';

  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    let html = '';

    querySnapshot.forEach((docSnap) => {
      const userData = docSnap.data();
      const userId = docSnap.id;

      html += `
        <div class="user-item">
          <p><strong>${userData.nombre}</strong> - ${userData.email}</p>
          <p>Cédula: ${userData.cedula} | Autorizado: 
            <span style="color:${userData.autorizado ? 'green' : 'red'}">
              ${userData.autorizado ? 'Sí' : 'No'}
            </span>
          </p>
          <button onclick="authorizeUser('${userId}', ${userData.autorizado})">
            ${userData.autorizado ? 'Revocar' : 'Autorizar'}
          </button>
          <hr>
        </div>
      `;
    });

    userListDiv.innerHTML = html || '<p>No hay usuarios registrados.</p>';
  } catch (error) {
    console.error("Error al cargar usuarios:", error);
    userListDiv.innerHTML = '<p>Error al cargar usuarios.</p>';
  }
}

window.authorizeUser = async (uid, currentStatus) => {
  const newStatus = !currentStatus;
  try {
    await updateDoc(doc(db, 'users', uid), {
      autorizado: newStatus
    });
    showAlert(`Usuario ${newStatus ? 'autorizado' : 'revocado'} correctamente`, 'success');
    loadUsers(); // actualizar lista
  } catch (err) {
    console.error('Error al actualizar autorización:', err);
    showAlert('Error al actualizar autorización', 'error');
  }
};
