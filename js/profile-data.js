// Firebase core config
import { auth, db } from './firebase-config.js';

// Firebase Firestore SDK
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Funciones reutilizables
import { showAlert } from './showAlert.js';

// Obtener el formulario
const profileForm = document.getElementById('profileForm');
const fullNameInput = document.getElementById('full_name');
const cedulaInput = document.getElementById('cedula');
const phoneInput = document.getElementById('phone');

// Función para guardar datos en Firestore
profileForm.addEventListener('submit', async function(event) {
  event.preventDefault();
  
  const fullName = fullNameInput.value;
  const cedula = cedulaInput.value;
  const phone = phoneInput.value;

  try {
    // Obtener el usuario autenticado
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error("No se encontró un usuario autenticado.");
    }

    // Guardar los datos en Firestore usando la cédula como ID del documento
    await setDoc(doc(db, "users", cedula), {
      fullName: fullName,
      cedula: cedula,
      phone: phone,
      email: user.email,  // Usamos el email del usuario autenticado
      isAuthorized: true   // Asumimos que el usuario está autorizado por defecto
    });

    // Mostrar alerta de éxito
    showAlert("Datos guardados correctamente.", 'success');

    // Redirigir al usuario al dashboard o página de inicio
    setTimeout(() => {
      window.location.href = "./client-dashboard.html";  // Redirige a la página principal de usuarios
    }, 1500);
  
  } catch (error) {
    console.error('Error al guardar los datos personales:', error.message);
    showAlert('Error al guardar los datos: ' + error.message, 'error');
  }
});
