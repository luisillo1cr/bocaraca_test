import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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
            const q = query(collection(db, 'reservations'));
    
            onSnapshot(q, (querySnapshot) => {
                const reservationsByDate = {};
    
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    const date = data.date;
                    const name = data.fullName || data.name || "Desconocido";
    
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
