import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Formulario
const registerForm = document.getElementById("registerForm");

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fullName = document.getElementById("nombre").value.trim();
  const cedula = document.getElementById("cedula").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!fullName || !cedula || !phone || !email || !password) {
    showToast("Por favor, completa todos los campos", "error");
    return;
  }

  try {
    // Validar si ya existe una cédula registrada
    const q = query(collection(db, "users"), where("cedula", "==", cedula));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      showToast("Ya existe un usuario registrado con esta cédula", "error");
      return;
    }

    // Crear el usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Guardar en Firestore
    await addDoc(collection(db, "users"), {
      uid: user.uid,
      nombre: fullName,
      cedula,
      correo: email,
      celular: phone,
      autorizado: false,
      reservas: 0,
    });

    showToast("Registro exitoso. Redirigiendo...", "success");

    setTimeout(() => {
      window.location.href = "./index.html";
    }, 2000);

  } catch (error) {
    const mensaje = mapAuthError(error.code);
    showToast(mensaje, "error");
  }
});

// Función para mostrar mensajes
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Mapeo de errores de Firebase
function mapAuthError(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "Este correo ya está registrado";
    case "auth/weak-password":
      return "La contraseña debe tener al menos 6 caracteres";
    case "auth/invalid-email":
      return "El correo no es válido";
    default:
      return "Error al registrar. Intenta de nuevo.";
  }
}
