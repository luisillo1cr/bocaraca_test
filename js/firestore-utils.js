// firestore-utils.js
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './firebase-config.js'; // Ahora importa db correctamente

export async function guardarUsuarioPorCedula(cedula, fullName, phone, email) {
  try {
    await setDoc(doc(db, "users", cedula), {
      fullName: fullName,
      cedula: cedula,
      phone: phone,
      email: email,
      isAuthorized: true
    });
    console.log("Usuario guardado correctamente con cédula como ID.");
  } catch (error) {
    console.error("Error al guardar usuario en Firestore:", error);
    throw error;
  }
}