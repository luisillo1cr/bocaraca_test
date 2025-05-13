import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './firebase-config.js';
import { showAlert } from './showAlert.js';

async function descargarReporteAsistencia() {
try {
    // Accedemos a la colección 'asistencias'
    const asistenciaRef = collection(db, 'asistencias');
    const snapshot = await getDocs(asistenciaRef);

    // Comprobamos cuántos documentos (fechas) hay en 'asistencias'
    console.log(`Número de documentos en 'asistencias': ${snapshot.size}`);

    // Si no se encontraron documentos, mostramos un mensaje de error
    if (snapshot.empty) {
    console.log('No se encontraron documentos en la colección "asistencias"');
    showAlert('No hay registros de asistencia disponibles', 'error');
    return;
    }

    // Preparamos los encabezados del reporte
    let datos = [["Fecha", "Nombre", "Hora", "Presente"]];

    // Recorremos los documentos (fechas) en la colección 'asistencias'
    for (const doc of snapshot.docs) {
      const fecha = doc.id; // Usamos la ID del documento como fecha

      // Accedemos a la subcolección 'usuarios' para esa fecha
    const usuariosRef = collection(db, `asistencias/${fecha}/usuarios`);
    const usuariosSnap = await getDocs(usuariosRef);

      // Creamos dos listas para separar los usuarios por presencia
    const usuariosPresentes = [];
    const usuariosAusentes = [];

      // Recorremos los usuarios de la subcolección
    usuariosSnap.forEach(userDoc => {
        const data = userDoc.data();
        // Si el usuario está presente, lo agregamos a la lista de presentes
        if (data.presente) {
        usuariosPresentes.push([fecha, data.nombre, data.hora, "Sí"]);
        } else {
          // Si el usuario no está presente, lo agregamos a la lista de ausentes
        usuariosAusentes.push([fecha, data.nombre, data.hora, "No"]);
        }
    });

      // Añadimos los usuarios presentes primero
    datos = datos.concat(usuariosPresentes);
      // Luego añadimos los usuarios ausentes
    datos = datos.concat(usuariosAusentes);
    }

    // Usamos la librería 'XLSX' para crear y descargar el archivo Excel
    const ws = XLSX.utils.aoa_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
    XLSX.writeFile(wb, "reporte_asistencia.xlsx");

} catch (error) {
    console.error("Error al generar el reporte:", error);
    showAlert("Hubo un error al generar el reporte", "error");
}
}

// Asignamos la función al evento de clic en el botón de descarga
window.descargarReporteAsistencia = descargarReporteAsistencia;
document.getElementById('btnDescargar').addEventListener('click', descargarReporteAsistencia);
