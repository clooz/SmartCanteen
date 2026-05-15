const { pool } = require('../db/connection');
const {
  ALL_KEYS,
  SUPER_ADMIN_CODE,
} = require('../constants/permissions');

/** admin 且未绑岗位时是否视为拥有全部权限（迁移友好，可用 ADMIN_RBAC_FALLBACK=0 关闭） */
function adminFallbackFullAccess() {
  return String(process.env.ADMIN_RBAC_FALLBACK || '1').trim() !== '0';
}

/**
 * 解析用户后台权限
 * @returns {{ permissionSet: Set<string>, roleCode: string|null, adminRoleId: number|null, isSuperAdmin: boolean }}
 */
async function resolveUserRbac(userId) {
  const [rows] = await pool.query(
    `SELECT u.admin_role_id, u.role AS user_role, ar.code AS role_code
     FROM users u
     LEFT JOIN admin_roles ar ON ar.id = u.admin_role_id
     WHERE u.id = ?`,
    [userId]
  );
  if (!rows.length) {
    return { permissionSet: new Set(), roleCode: null, adminRoleId: null, isSuperAdmin: false };
  }
  const { admin_role_id, user_role, role_code } = rows[0];

  if (role_code === SUPER_ADMIN_CODE) {
    return {
      permissionSet: new Set(ALL_KEYS),
      roleCode: SUPER_ADMIN_CODE,
      adminRoleId: admin_role_id,
      isSuperAdmin: true,
    };
  }

  if (user_role === 'admin' && !admin_role_id && adminFallbackFullAccess()) {
    return {
      permissionSet: new Set(ALL_KEYS),
      roleCode: null,
      adminRoleId: null,
      isSuperAdmin: true,
    };
  }

  if (!admin_role_id) {
    return {
      permissionSet: new Set(),
      roleCode: null,
      adminRoleId: null,
      isSuperAdmin: false,
    };
  }

  const [permRows] = await pool.query(
    'SELECT permission_key FROM admin_role_permissions WHERE role_id = ?',
    [admin_role_id]
  );
  const permissionSet = new Set(permRows.map((r) => r.permission_key));
  return {
    permissionSet,
    roleCode: role_code || null,
    adminRoleId: admin_role_id,
    isSuperAdmin: false,
  };
}

async function getRoleIdByCode(code) {
  const [r] = await pool.query('SELECT id FROM admin_roles WHERE code = ?', [code]);
  return r.length ? r[0].id : null;
}

async function isSuperAdminUser(userId) {
  const rbac = await resolveUserRbac(userId);
  return rbac.isSuperAdmin;
}

module.exports = {
  resolveUserRbac,
  adminFallbackFullAccess,
  getRoleIdByCode,
  isSuperAdminUser,
  SUPER_ADMIN_CODE,
};
