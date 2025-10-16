// functions/admin-claims.js (Cloud Functions - Node.js CommonJS)
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

if (!admin.apps.length) admin.initializeApp();

import { gateAdmin } from './role-guard.js';
await gateAdmin(); // redirige a client-dashboard si no es admin


/* ========= Helpers ========= */
async function verifyBearer(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(m[1], true);
    return decoded; // { uid, admin?:bool, ... }
  } catch {
    return null;
  }
}

async function callerIsAdmin(decoded) {
  if (!decoded) return false;
  if (decoded.admin === true) return true; // custom claim ya marcado
  // Fallback leyendo roles en Firestore
  try {
    const snap = await admin.firestore().doc(`users/${decoded.uid}`).get();
    const roles = (snap.exists && Array.isArray(snap.data().roles)) ? snap.data().roles : [];
    return roles.includes('admin');
  } catch {
    return false;
  }
}

function pickClaimsFromBody(body) {
  // Acepta roles: ['admin','professor'] o flags { admin: true, professor: false }
  const out = {};
  if (Array.isArray(body.roles)) {
    out.admin = body.roles.includes('admin');
    out.professor = body.roles.includes('professor');
  }
  if (typeof body.admin === 'boolean') out.admin = body.admin;
  if (typeof body.professor === 'boolean') out.professor = body.professor;
  // default a false si no vino nada (evita undefined al fusionar)
  if (typeof out.admin === 'undefined') out.admin = false;
  if (typeof out.professor === 'undefined') out.professor = false;
  return out;
}

async function setClaimsMerging(targetUid, partialClaims) {
  const userRec = await admin.auth().getUser(targetUid);
  const current = userRec.customClaims || {};
  const next = {
    ...current,
    admin: !!partialClaims.admin,
    professor: !!partialClaims.professor
  };
  await admin.auth().setCustomUserClaims(targetUid, next);
  return next;
}

function sendJSON(res, code, payload) {
  res.status(code).json(payload);
}

/* ========= HTTP: genérico /syncUserClaims =========
   POST body: { uid: 'targetUid', roles?: ['admin','professor'], admin?:bool, professor?:bool }
   Auth: Authorization: Bearer <ID_TOKEN>
==================================================== */
exports.syncUserClaims = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    // Preflight
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.status(204).send('');
    }
    if (req.method !== 'POST') {
      return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });
    }

    try {
      const decoded = await verifyBearer(req);
      if (!await callerIsAdmin(decoded)) {
        return sendJSON(res, 403, { ok: false, error: 'Not authorized' });
      }

      const body = typeof req.body === 'object' ? req.body : {};
      const targetUid = body.uid;
      if (!targetUid) return sendJSON(res, 400, { ok: false, error: 'uid is required' });

      const claims = pickClaimsFromBody(body);
      const newClaims = await setClaimsMerging(targetUid, claims);

      // Sugerencia: el cliente debe re-loguear para refrescar el ID token
      return sendJSON(res, 200, { ok: true, uid: targetUid, claims: newClaims, hint: 'Client should refresh ID token' });
    } catch (err) {
      console.error('syncUserClaims error:', err);
      return sendJSON(res, 500, { ok: false, error: 'Internal error' });
    }
  });
});

/* ========= HTTP: legacy /assignAdminRole =========
   Compatibilidad con el código anterior.
   POST (o GET) ?uid=<target> —> pone admin=true y preserva otros claims.
=================================================== */
exports.assignAdminRole = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.status(204).send('');
    }

    try {
      const decoded = await verifyBearer(req);
      if (!await callerIsAdmin(decoded)) {
        return sendJSON(res, 403, { ok: false, error: 'Not authorized' });
      }

      const targetUid = (req.method === 'POST' ? req.body?.uid : req.query?.uid) || '';
      if (!targetUid) return sendJSON(res, 400, { ok: false, error: 'uid is required' });

      const newClaims = await setClaimsMerging(targetUid, { admin: true });
      return sendJSON(res, 200, { ok: true, uid: targetUid, claims: newClaims, hint: 'Client should refresh ID token' });
    } catch (err) {
      console.error('assignAdminRole error:', err);
      return sendJSON(res, 500, { ok: false, error: 'Internal error' });
    }
  });
});

/* ========= Callable (opcional) =========
   Invócala desde el cliente con functions.httpsCallable('syncUserClaimsCallable')
   data: { uid, roles?:[], admin?:bool, professor?:bool }
======================================== */
exports.syncUserClaimsCallable = functions.https.onCall(async (data, context) => {
  const caller = context.auth;
  if (!caller) throw new functions.https.HttpsError('unauthenticated', 'Auth required');

  const fakeReqDecoded = { uid: caller.uid, admin: caller.token?.admin === true };
  if (!await callerIsAdmin(fakeReqDecoded)) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized');
  }

  const targetUid = data?.uid;
  if (!targetUid) throw new functions.https.HttpsError('invalid-argument', 'uid is required');

  const claims = pickClaimsFromBody(data || {});
  const newClaims = await setClaimsMerging(targetUid, claims);
  return { ok: true, uid: targetUid, claims: newClaims, hint: 'Client should refresh ID token' };
});
