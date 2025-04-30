import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, query, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

document.addEventListener('DOMContentLoaded', function () {
    const calendarEl = document.getElementById('calendar');
    const usersListContainer = document.getElementById('usersListContainer');

    // Mostrar la lista de usuarios
    loadUsersList(usersListContainer);

    // Cargar el calendario de FullCalendar
    const calendar = new FullCalendar.Calendar(calendarEl, {
        locale: 'es',
        initialView: window.innerWidth < 768 ? 'listWeek' : 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,dayGridWeek,dayGridDay'
        },
        events: function (info, successCallback, failureCallback) {
            const q = query(collection(db, 'reservations'));

            onSnapshot(q, (querySnapshot) => {
                const reservationsByDate = {};

                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    const date = data.date;
                    const name = data.nombre || "Desconocido";

                    if (date) {
                        if (!reservationsByDate[date]) {
                            reservationsByDate[date] = [];
                        }
                        reservationsByDate[date].push(name);
                    }
                });

                const events = Object.keys(reservationsByDate).map(date => ({
                    title: `${reservationsByDate[date].length}`,
                    start: date,
                    allDay: true,
                    extendedProps: {
                        names: reservationsByDate[date]
                    }
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
        eventMouseEnter: function(info) {
            const tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip';
            tooltip.innerHTML = `<strong>Usuarios:</strong><br>${info.event.extendedProps.names.join('<br>')}`;
            document.body.appendChild(tooltip);

            function positionTooltip(e) {
                tooltip.style.left = `${e.pageX + 10}px`;
                tooltip.style.top = `${e.pageY + 10}px`;
            }

            positionTooltip(info.jsEvent);

            info.el.addEventListener('mousemove', positionTooltip);

            info.el.addEventListener('mouseleave', function() {
                tooltip.remove();
            });
        },
        dayCellClassNames: function(arg) {
            const day = arg.date.getDay();
            if (day !== 5 && day !== 6) {
                return ['disabled-day'];
            }
        }
    });

    calendar.render();

    // Función para cargar los usuarios desde Firestore
    async function loadUsersList(container) {
        const q = query(collection(db, 'users'));
        const querySnapshot = await getDocs(q);

        // Limpiar la lista de usuarios antes de agregar nuevos elementos
        container.innerHTML = '';

        querySnapshot.forEach(doc => {
            const userData = doc.data();
            const userId = doc.id;
            const nombreCompleto = userData.nombre;
            const reservasHabilitadas = userData.reservasHabilitadas || false;

            // Crear el HTML para mostrar al usuario
            const userElement = document.createElement('div');
            userElement.className = 'user-item';
            userElement.innerHTML = `
                <span>${nombreCompleto}</span>
                <label class="switch">
                    <input type="checkbox" ${reservasHabilitadas ? 'checked' : ''} data-user-id="${userId}">
                    <span class="slider round"></span>
                </label>
            `;

            // Agregar el evento para el switch
            const switchInput = userElement.querySelector('input[type="checkbox"]');
            switchInput.addEventListener('change', async (event) => {
                const userId = event.target.getAttribute('data-user-id');
                const isChecked = event.target.checked;
                try {
                    await updateUserReservationStatus(userId, isChecked);
                    showAlert(`Usuario ${isChecked ? 'habilitado' : 'deshabilitado'} para hacer reservas.`, 'success');
                } catch (error) {
                    console.error('Error al actualizar el estado del usuario:', error);
                    showAlert('Hubo un error al actualizar el estado.', 'error');
                }
            });

            container.appendChild(userElement);
        });
    }

    // Función para actualizar el estado de reservas de un usuario
    async function updateUserReservationStatus(userId, status) {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            reservasHabilitadas: status
        });
    }
});

// Cerrar sesión
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
