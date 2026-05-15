const { pool } = require('../db/connection');
const { success, fail } = require('../utils/response');
const {
  PERMISSIONS,
  ALL_KEYS,
  SUPER_ADMIN_CODE,
  CHEF_DEFAULT_CODE,
} = require('../constants/permissions');
const { resolveUserRbac } = require('../services/rbacService');

async function writeAudit(actorId, action, detail) {
  try {
    await pool.query(
      'INSERT INTO admin_audit_logs (actor_id, action, detail_json) VALUES (?, ?, ?)',
      [actorId, action, JSON.stringify(detail || {})]
    );
  } catch (e) {
    console.warn('writeAudit failed', e.message);
  }
}

const requireSuper = (req, res, next) => {
  if (!req.rbac?.isSuperAdmin) return fail(res, '权限不足', 403);
  next();
};

const listRoles = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ar.id, ar.code, ar.name, ar.description, ar.is_system, ar.created_at, ar.updated_at,
              COUNT(u.id) AS user_count
       FROM admin_roles ar
       LEFT JOIN users u ON u.admin_role_id = ar.id
       GROUP BY ar.id, ar.code, ar.name, ar.description, ar.is_system, ar.created_at, ar.updated_at
       ORDER BY ar.is_system DESC, ar.id`
    );
    return success(res, rows.map((r) => ({ ...r, user_count: Number(r.user_count) })));
  } catch (e) {
    console.error(e);
    return fail(res, '服务器错误', 500);
  }
};

const getPermissionCatalog = async (req, res) => success(res, { list: PERMISSIONS });

const createRole = async (req, res) => {
  const { code, name, description = '' } = req.body;
  const c = String(code || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (!c || !name) return fail(res, '编码与名称不能为空');
  if (['super_admin', 'chef_default', 'system_admin'].includes(c)) {
    return fail(res, '该编码为系统保留', 400);
  }
  try {
    const [dup] = await pool.query('SELECT id FROM admin_roles WHERE code = ?', [c]);
    if (dup.length) return fail(res, '编码已存在', 400);
    const [r] = await pool.query(
      'INSERT INTO admin_roles (code, name, description, is_system) VALUES (?, ?, ?, 0)',
      [c, String(name).trim(), String(description).trim()]
    );
    await writeAudit(req.user.id, 'role_created', { role_id: r.insertId, code: c });
    return success(res, { id: r.insertId }, '已创建', 201);
  } catch (e) {
    console.error(e);
    return fail(res, '服务器错误', 500);
  }
};

const updateRoleMeta = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, description } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM admin_roles WHERE id = ?', [id]);
    if (!rows.length) return fail(res, '岗位不存在', 404);
    const r = rows[0];
    if (r.is_system && [SUPER_ADMIN_CODE, CHEF_DEFAULT_CODE, 'system_admin'].includes(r.code)) {
      const sets = [];
      const vals = [];
      if (name !== undefined) {
        sets.push('name = ?');
        vals.push(String(name).trim());
      }
      if (description !== undefined) {
        sets.push('description = ?');
        vals.push(String(description).trim());
      }
      if (!sets.length) return fail(res, '没有要更新的字段');
      vals.push(id);
      await pool.query(`UPDATE admin_roles SET ${sets.join(', ')} WHERE id = ?`, vals);
      await writeAudit(req.user.id, 'role_meta_updated', { role_id: id });
      return success(res, null, '已更新');
    }
    if (!r.is_system) {
      const sets = [];
      const vals = [];
      if (name !== undefined) {
        sets.push('name = ?');
        vals.push(String(name).trim());
      }
      if (description !== undefined) {
        sets.push('description = ?');
        vals.push(String(description).trim());
      }
      if (!sets.length) return fail(res, '没有要更新的字段');
      vals.push(id);
      await pool.query(`UPDATE admin_roles SET ${sets.join(', ')} WHERE id = ?`, vals);
      await writeAudit(req.user.id, 'role_meta_updated', { role_id: id });
      return success(res, null, '已更新');
    }
    return fail(res, '系统岗位不允许修改名称外的敏感项', 400);
  } catch (e) {
    console.error(e);
    return fail(res, '服务器错误', 500);
  }
};

const deleteRole = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const [rows] = await pool.query('SELECT * FROM admin_roles WHERE id = ?', [id]);
    if (!rows.length) return fail(res, '岗位不存在', 404);
    if (rows[0].is_system) return fail(res, '系统预置岗位不可删除', 400);
    const [uc] = await pool.query('SELECT COUNT(*) AS n FROM users WHERE admin_role_id = ?', [id]);
    if (uc[0].n > 0) return fail(res, '仍有用户绑定此岗位，请先迁移', 400);
    await pool.query('DELETE FROM admin_roles WHERE id = ?', [id]);
    await writeAudit(req.user.id, 'role_deleted', { role_id: id });
    return success(res, null, '已删除');
  } catch (e) {
    console.error(e);
    return fail(res, '服务器错误', 500);
  }
};

const getRolePermissions = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const [rows] = await pool.query('SELECT code FROM admin_roles WHERE id = ?', [id]);
    if (!rows.length) return fail(res, '岗位不存在', 404);
    if (rows[0].code === SUPER_ADMIN_CODE) {
      return success(res, { keys: [...ALL_KEYS] });
    }
    const [permRows] = await pool.query(
      'SELECT permission_key FROM admin_role_permissions WHERE role_id = ?',
      [id]
    );
    return success(res, { keys: permRows.map((r) => r.permission_key) });
  } catch (e) {
    console.error(e);
    return fail(res, '服务器错误', 500);
  }
};

const updateRolePermissions = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { permission_keys: keys } = req.body;
  if (!Array.isArray(keys)) return fail(res, 'permission_keys 须为数组');

  try {
    const [rows] = await pool.query('SELECT * FROM admin_roles WHERE id = ?', [id]);
    if (!rows.length) return fail(res, '岗位不存在', 404);
    const role = rows[0];
    if (role.code === SUPER_ADMIN_CODE) {
      return fail(res, '超级管理员岗位权限由系统固定，不可编辑', 400);
    }

    const invalid = keys.filter((k) => !ALL_KEYS.includes(k));
    if (invalid.length) return fail(res, `无效权限: ${invalid.join(', ')}`, 400);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM admin_role_permissions WHERE role_id = ?', [id]);
      for (const k of keys) {
        await conn.query(
          'INSERT INTO admin_role_permissions (role_id, permission_key) VALUES (?, ?)',
          [id, k]
        );
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    await writeAudit(req.user.id, 'role_permissions_updated', { role_id: id, keys });
    return success(res, null, '权限已保存');
  } catch (e) {
    console.error(e);
    return fail(res, '服务器错误', 500);
  }
};

const listAuditLogs = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size, 10) || 20));
  const offset = (page - 1) * pageSize;
  try {
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM admin_audit_logs');
    const [list] = await pool.query(
      `SELECT l.id, l.actor_id, u.username AS actor_username, l.action, l.detail_json, l.created_at
       FROM admin_audit_logs l
       LEFT JOIN users u ON u.id = l.actor_id
       ORDER BY l.id DESC
       LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );
    return success(res, { total, page, page_size: pageSize, list });
  } catch (e) {
    console.error(e);
    return fail(res, '服务器错误', 500);
  }
};

/** 某后台岗位下的用户（仅 admin_role_id 精确匹配；供权限管理「岗位成员」抽屉） */
const listRoleMembers = async (req, res) => {
  try {
    const roleId = parseInt(req.params.id, 10);
    if (!Number.isInteger(roleId) || roleId < 1) return fail(res, '无效的岗位 ID', 400);

    const [roleRows] = await pool.query('SELECT id, code, name FROM admin_roles WHERE id = ? LIMIT 1', [roleId]);
    if (!roleRows.length) return fail(res, '岗位不存在', 404);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSizeRaw = parseInt(req.query.page_size, 10) || 50;
    const pageSize = Math.min(100, Math.max(1, pageSizeRaw));
    const offset = (page - 1) * pageSize;

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM users WHERE admin_role_id = ?',
      [roleId]
    );
    const [list] = await pool.query(
      `SELECT u.id, u.username, u.nickname, u.role, u.admin_role_id,
              ar.name AS admin_role_name, ar.code AS admin_role_code,
              c.name AS company_name
       FROM users u
       LEFT JOIN admin_roles ar ON ar.id = u.admin_role_id
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.admin_role_id = ?
       ORDER BY u.id ASC
       LIMIT ? OFFSET ?`,
      [roleId, pageSize, offset]
    );
    return success(res, {
      role: { id: roleRows[0].id, code: roleRows[0].code, name: roleRows[0].name },
      total: Number(total),
      page,
      page_size: pageSize,
      list,
    });
  } catch (e) {
    console.error(e);
    return fail(res, '服务器错误', 500);
  }
};

/** 供用户表单：可绑定的岗位（非超管调用时排除 super_admin） */
const listRolesForAssign = async (req, res) => {
  try {
    const rbac = await resolveUserRbac(req.user.id);
    let sql = 'SELECT id, code, name, description, is_system FROM admin_roles ORDER BY is_system DESC, id';
    const params = [];
    if (!rbac.isSuperAdmin) {
      sql = 'SELECT id, code, name, description, is_system FROM admin_roles WHERE code <> ? ORDER BY id';
      params.push(SUPER_ADMIN_CODE);
    }
    const [rows] = await pool.query(sql, params);
    return success(res, rows);
  } catch (e) {
    console.error(e);
    return fail(res, '服务器错误', 500);
  }
};

module.exports = {
  requireSuper,
  listRoles,
  listRoleMembers,
  getPermissionCatalog,
  getRolePermissions,
  createRole,
  updateRoleMeta,
  deleteRole,
  updateRolePermissions,
  listAuditLogs,
  listRolesForAssign,
  writeAudit,
};
