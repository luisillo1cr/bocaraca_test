// firestore-utils.js
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './firebase-config.js'; // Ahora importa db correctamente

// Función para guardar el usuario en Firestore
export async function guardarUsuarioPorCedula(cedula, fullName, phone, email) {
  try {
    // Usamos la cédula como ID del documento
    await setDoc(doc(db, 'users', cedula), {
      fullName: fullName,
      cedula: cedula,
      phone: phone,
      email: email,
      isAuthorized: true // Por defecto, autorizado
    });
    console.log("Usuario guardado correctamente con cédula como ID.");
  } catch (error) {
    console.error("Error al guardar usuario en Firestore:", error);
    throw error;
  }
}
