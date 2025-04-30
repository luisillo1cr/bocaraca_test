import { auth, db, app } from './firebase-config.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const form = document.getElementById('registerForm');
const toastContainer = document.getElementById('toast-container');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const cedula = form.cedula.value.trim();
  const nombre = form.full_name.value.trim();  // Corregir aquí
  const phone = form.phone.value.trim();      // Nuevo campo "Celular"
  const email = form.email.value.trim();
  const password = form.password.value;

  try {
    // Crear usuario en Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Guardar en Firestore
    await setDoc(doc(db, 'users', uid), {
      cedula,
      nombre,
      phone,         // Agregar celular aquí
      email,
      uid,
      autorizado: false,
      esAdmin: false
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
