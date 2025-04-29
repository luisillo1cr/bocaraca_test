import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, getDocs, query, collection, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

const registerForm = document.getElementById('registerForm');

registerForm.addEventListener('submit', async function(event) {
  event.preventDefault();

  const nombre = document.getElementById('full_name').value.trim();
  const cedula = document.getElementById('cedula').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    // Verificar si la cédula ya está registrada
    const cedulaQuery = await getDocs(query(collection(db, 'users'), where('cedula', '==', cedula)));
    if (!cedulaQuery.empty) {
      showAlert('La cédula ya está registrada.', 'error');
      return;
    }

    // Crear usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Obtener el usuario autenticado actual
    const user = userCredential.user;

    if (!user) {
      showAlert("Error: no se pudo obtener el usuario autenticado.", "error");
      return;
    }

    console.log("UID autenticado:", user.uid); // Para debug visual

    // Guardar en Firestore con la estructura correcta
    await setDoc(doc(db, 'users', user.uid), {
      nombre: nombre,
      cedula: cedula,
      celular: phone,
      email: email,
      autorizado: false,
      admin: false,
      uid: user.uid
    });

    showAlert("Usuario registrado exitosamente.", 'success');

    setTimeout(() => {
      window.location.href = "./index.html";
    }, 1500);

  } catch (error) {
    console.error('Error en el registro:', error);
    showAlert('Error al registrar: ' + error.message, 'error');
  }
});
