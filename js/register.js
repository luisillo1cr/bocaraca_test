// Firebase core config
import { auth, db } from './firebase-config.js';

// Firebase Auth y Firestore SDKs
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { guardarUsuarioPorCedula } from './firestore-utils.js'; // <-- NUEVO IMPORT
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Funciones reutilizables
import { showAlert } from './showAlert.js';

// Obtener el formulario
const registerForm = document.getElementById('registerForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const fullNameInput = document.getElementById('full_name');
const cedulaInput = document.getElementById('cedula');
const phoneInput = document.getElementById('phone');

const db = getFirestore(); // Inicializamos Firestore

registerForm.addEventListener('submit', async function(event) {
  event.preventDefault();
  
  const email = emailInput.value;
  const password = passwordInput.value;
  const fullName = fullNameInput.value;
  const cedula = cedulaInput.value;
  const phone = phoneInput.value;

  try {
    // Crear usuario en Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
  
    // Guardar datos adicionales en Firestore con la cédula como ID
    await guardarUsuarioPorCedula(cedula, fullName, phone, email);
  
    // Mostrar alerta de éxito
    showAlert("Usuario registrado exitosamente: " + email, 'success');
  
    // Redirigir después de un pequeño delay para ver la alerta
    setTimeout(() => {
      window.location.href = "./index.html"; 
    }, 1500);
  
  } catch (error) {
    console.error('Error en el registro:', error.message);
    showAlert('Error al registrar: ' + error.message, 'error');
  }
});
