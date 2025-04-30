// Firebase core config
import { auth } from './firebase-config.js';

// Firebase Auth SDK
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { showAlert } from './showAlert.js';

// Obtener el formulario
const registerForm = document.getElementById('registerForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

registerForm.addEventListener('submit', async function(event) {
  event.preventDefault();
  
  const email = emailInput.value;
  const password = passwordInput.value;

  try {
    // Crear usuario en Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
  
    // Mostrar alerta de éxito
    showAlert("Usuario registrado exitosamente: " + email, 'success');
  
    // Redirigir a la página de ingreso de datos personales
    setTimeout(() => {
      window.location.href = "./profile-data.html"; // Nueva página para ingresar los datos
    }, 1500);
  
  } catch (error) {
    console.error('Error en el registro:', error.message);
    showAlert('Error al registrar: ' + error.message, 'error');
  }
});
