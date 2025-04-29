const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// Cloud Function para asignar el rol de administrador a un usuario
exports.assignAdminRole = functions.https.onRequest(async (req, res) => {
  // Solo permitir solicitudes GET por seguridad básica
  if (req.method !== 'GET') {
    return res.status(403).send('Método no permitido');
  }

  const uid = req.query.uid;

  if (!uid) {
    return res.status(400).send('Falta el parámetro "uid" en la solicitud');
  }

  try {
    // Asignar el claim personalizado "admin: true" al usuario
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    console.log(`Rol de administrador asignado al UID: ${uid}`);

    return res.status(200).send(`Rol de administrador asignado al usuario con UID: ${uid}`);
  } catch (error) {
    console.error('Error al asignar el rol de administrador:', error);
    return res.status(500).send('Error al asignar el rol de administrador');
  }
});
