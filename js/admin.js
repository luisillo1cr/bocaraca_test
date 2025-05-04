import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    collection,
    query,
    onSnapshot,
    updateDoc,
    doc,
    setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

document.addEventListener('DOMContentLoaded', () => {
    const ADMIN_UIDS = [
        "TWAkND9zF0UKdMzswAPkgas9zfL2", // ivan.cicc@hotmail.com
        "ScODWX8zq1ZXpzbbKk5vuHwSo7N2"  // luis.davidsolorzano@outlook.es
    ];

    onAuthStateChanged(auth, (user) => {
        if (!user || !ADMIN_UIDS.includes(user.uid)) {
            window.location.href = './index.html';
            return;
        }

        iniciarPanelAdmin();
    });
});

function iniciarPanelAdmin() {
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

                querySnapshot.forEach(docSnap => {
                    const data = docSnap.data();
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
        eventClick: function (info) {
            info.jsEvent.preventDefault();
        },
        eventMouseEnter: function (info) {
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
            info.el.addEventListener('mouseleave', () => tooltip.remove());
        },
        dayCellClassNames: function (arg) {
            const day = arg.date.getDay();
            if (day !== 5 && day !== 6) {
                return ['disabled-day'];
            }
        }
    });

    calendar.render();

    const usersListContainer = document.getElementById('usersList');
    const usersQuery = query(collection(db, 'users'));

    onSnapshot(usersQuery, (querySnapshot) => {
        usersListContainer.innerHTML = '';

        querySnapshot.forEach(userDoc => {
            const data = userDoc.data();
            const userId = userDoc.id;
            const nombre = data.nombre;
            const autorizado = data.autorizado;

            const userElement = document.createElement('div');
            userElement.classList.add('user-card');
            userElement.innerHTML = `
                <span>${nombre} (${data.cedula})</span>
                <label class="switch">
                    <input type="checkbox" ${autorizado ? 'checked' : ''} data-user-id="${userId}">
                    <span class="slider round"></span>
                </label>
                <label class="attendance-checkbox">
                    <input type="checkbox" data-user-id="${userId}" class="attendance-input"> Asistió
                </label>
            `;

            usersListContainer.appendChild(userElement);

            const switchInput = userElement.querySelector('input[type="checkbox"]');
            switchInput.addEventListener('change', async (event) => {
                const userId = event.target.getAttribute('data-user-id');
                const authorized = event.target.checked;

                try {
                    const userRef = doc(db, 'users', userId);
                    await updateDoc(userRef, { autorizado: authorized });
                    showAlert(`El usuario ${nombre} ahora está ${authorized ? 'autorizado' : 'desautorizado'}.`, 'success');
                } catch (error) {
                    console.error('Error al actualizar la autorización del usuario:', error);
                    showAlert('Hubo un error al actualizar la autorización.', 'error');
                }
            });

            const attendanceCheckbox = userElement.querySelector('.attendance-input');
            attendanceCheckbox.addEventListener('change', async (event) => {
                const userId = event.target.getAttribute('data-user-id');
                const attended = event.target.checked;
                const fecha = new Date().toISOString().split('T')[0];
                const hora = new Date().toTimeString().slice(0, 5);

                try {
                    const asistenciaRef = doc(db, 'asistencias', fecha, 'usuarios', userId);
                    await setDoc(asistenciaRef, {
                        nombre,
                        hora,
                        presente: attended
                    });
                    showAlert(`${nombre} ${attended ? 'ha asistido' : 'no ha asistido'}.`, 'success');
                } catch (error) {
                    console.error('Error al registrar la asistencia:', error);
                    showAlert('Hubo un error al registrar la asistencia.', 'error');
                }
            });
        });
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
}
