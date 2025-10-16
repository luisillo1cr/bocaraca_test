// ./js/admin-auth.js
export {
  waitForUser,
  getMyRoles as getUserRoles,
  isAdminUser as requireAdmin,                 // devuelve boolean
  isStaffUser as requireAdminOrProfessor,      // devuelve boolean
  gateAdmin,
  gateStaff,
  decideLanding
} from './role-guard.js';
