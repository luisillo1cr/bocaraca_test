import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { ref, set } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js';

const form = document.getElementById('registerForm');
const toastContainer = document.getElementById('toast-container');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const cedula = form.cedula.value.trim();
  const nombre = form.nombre.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;

  try {
    // Crear usuario en Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    console.log('UID del nuevo usuario:', uid);  // Aquí estamos mostrando el UID en la consola

    // Guardar en Firebase Realtime Database
    const userRef = ref(db, 'users/' + uid);  // 'users' es la colección en Realtime Database
    console.log('Referencia de usuario en la base de datos:', userRef);
    await set(userRef, {
      cedula,
      nombre,
      email,
      uid,
      autorizado: false,
      esAdmin: false
    }).then(() => {
      console.log('Datos guardados correctamente en Realtime Database');
    }).catch((error) => {
      console.error('Error al guardar en la base de datos:', error);
    });

    mostrarToast('Registro exitoso ✅', 'success');
    form.reset();

    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
  } catch (error) {
    console.error(error);
    mostrarToast('Error: ' + error.message, 'error');
  }
});

function mostrarToast(mensaje, tipo = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.textContent = mensaje;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
