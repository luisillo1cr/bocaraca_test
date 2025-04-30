import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, query, onSnapshot, updateDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

document.addEventListener('DOMContentLoaded', function () {
    // Mostrar los usuarios registrados con su nombre y estado de autorización
    const usersListContainer = document.getElementById('users-list'); // Asegúrate de tener un contenedor con este id

    const usersQuery = query(collection(db, 'users'));
    onSnapshot(usersQuery, (querySnapshot) => {
        usersListContainer.innerHTML = '';  // Limpiar la lista antes de agregar nuevos elementos
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const userId = doc.id;
            const nombre = data.nombre;
            const autorizado = data.autorizado;

            // Crear un elemento de usuario con un switch
            const userElement = document.createElement('div');
            userElement.classList.add('user-item');
            userElement.innerHTML = `
                <span>${nombre} (${data.cedula})</span>
                <label class="switch">
                    <input type="checkbox" ${autorizado ? 'checked' : ''} data-user-id="${userId}">
                    <span class="slider round"></span>
                </label>
            `;

            // Agregar el elemento a la lista
            usersListContainer.appendChild(userElement);

            // Detectar el cambio en el switch para actualizar la autorización
            const switchInput = userElement.querySelector('input[type="checkbox"]');
            switchInput.addEventListener('change', async (event) => {
                const userId = event.target.getAttribute('data-user-id');
                const authorized = event.target.checked;

                try {
                    const userRef = doc(db, 'users', userId);
                    await updateDoc(userRef, { autorizado: authorized });
                    showAlert(`El usuario ${nombre} ahora está ${authorized ? 'autorizado' : 'desautorizado'} para hacer reservas.`, 'success');
                } catch (error) {
                    console.error('Error al actualizar la autorización del usuario:', error);
                    showAlert('Hubo un error al actualizar la autorización.', 'error');
                }
            });
        });
    }, (error) => {
        console.error('Error al obtener los usuarios:', error);
    });

    // Aquí va tu código actual del calendario que sigue funcionando como antes.
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
