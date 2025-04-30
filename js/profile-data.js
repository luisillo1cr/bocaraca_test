import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const db = getFirestore(app);

const profileForm = document.getElementById("profileForm");

onAuthStateChanged(auth, (user) => {
  if (user) {
    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const fullName = document.getElementById("fullName").value.trim();
      const idNumber = document.getElementById("idNumber").value.trim();
      const email = document.getElementById("email").value.trim();

      try {
        await setDoc(doc(db, "users", user.uid), {
          fullName,
          idNumber,
          email,
          authorized: false // por si luego manejas autorización manual
        });

        alert("Datos guardados correctamente");
        window.location.href = "./client-dashboard.html";

      } catch (error) {
        console.error("Error al guardar los datos:", error);
        alert("Ocurrió un error al guardar los datos.");
      }
    });
  } else {
    // No hay usuario, redirigir al login
    window.location.href = "./index.html";
  }
});
