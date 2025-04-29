import { auth } from './firebase-config.js';  // Importa solo lo necesario
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { showAlert } from './showAlert.js';  // Tu función para mostrar alertas

const registerForm = document.getElementById('registerForm');

registerForm.addEventListener('submit', async function(event) {
  event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  try {
    // Intentar crear el usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Si el registro es exitoso, mostramos un mensaje de éxito
    showAlert('Usuario registrado exitosamente.', 'success');

    // Redirigir a la página de inicio de sesión o dashboard después de 1.5 segundos
    setTimeout(() => {
      window.location.href = "./index.html"; // Redirige a la página principal o de login
    }, 1500);

  } catch (error) {
    console.error('Error en el registro:', error);
    showAlert('Error al registrar: ' + error.message, 'error');  // Muestra un mensaje de error
  }
});
