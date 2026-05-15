const bcrypt = require('bcryptjs');
const { pool } = require('../db/connection');
const { success, fail } = require('../utils/response');
const { normalizePhone } = require('../services/smsService');
const { resolveUserRbac } = require('../services/rbacService');
const { SUPER_ADMIN_CODE, CHEF_DEFAULT_CODE } = require('../constants/permissions');
const { writeAudit } = require('./rbacController');

function normalizeUsername(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  return s.includes('@') ? s.toLowerCase() : s;
}

/**
 * 批量同步/导入用户（外部工作平台对接入口）
 *
 * POST /admin/users/sync
 * Body: {
 *   source: 'dingtalk' | 'wecom' | 'feishu' | 'hr' | string,  // 来源标识
 *   users: [{
 *     ext_uid:      string,   // 外部平台唯一ID（首选匹配键）
 *     username:     string,   // 本系统登录名，常用邮箱（ext_uid 缺失时匹配用）
 *     phone:        string,   // 可选，11 位手机号
 *     nickname:     string,   // 姓名/昵称
 *     company_code: string,   // 公司编码，如 A/B/C/D（可选）
 *     role:         'employee'|'chef'|'admin',  // 默认 employee
 *     is_active:    0|1,      // 默认 1
 *   }]
 * }
 * Response: { created, updated, skipped, errors[] }
 *
 * 对接说明：
 *   外部平台在人员变更后调用此接口即可自动更新餐厅系统用户，
 *   无需手工维护。新用户默认密码为 "123456"，建议首次登录修改。
 *   同一 ext_uid 多次同步只会 UPDATE，不会重复创建。
 *   role 仅支持 employee/chef/admin；与权限管理里可自定义的后台岗位不同。
 *   同步会按与手动创建相同的规则维护 admin_role_id：chef→默认厨师岗、admin→默认超管岗、
 *   employee→清空；若角色未变且已有 admin_role_id 则保留。
 */
const syncUsers = async (req, res) => {
  const { source, users } = req.body;
  if (!source) return fail(res, '请提供 source 来源标识');
  if (!Array.isArray(users) || users.length === 0) return fail(res, 'users 不能为空');

  // 预加载公司编码→ID映射
  const [companies] = await pool.query('SELECT id, code FROM companies');
  const codeToId = Object.fromEntries(companies.map((c) => [c.code.toUpperCase(), c.id]));

  let created = 0, updated = 0, skipped = 0;
  const errors = [];
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const [chefDefRows] = await pool.query('SELECT id FROM admin_roles WHERE code = ? LIMIT 1', [CHEF_DEFAULT_CODE]);
  const [superAdRows] = await pool.query('SELECT id FROM admin_roles WHERE code = ? LIMIT 1', [SUPER_ADMIN_CODE]);
  const chefDefId = chefDefRows[0]?.id ?? null;
  const superAdId = superAdRows[0]?.id ?? null;

  const syncResolveAdminRoleId = (prevRole, prevArId, newRole) => {
    if (newRole === 'employee') return null;
    const changed = prevRole !== newRole;
    if (!changed && prevArId) return prevArId;
    if (newRole === 'chef') return chefDefId;
    if (newRole === 'admin') return superAdId;
    return null;
  };

  for (const u of users) {
    const {
      ext_uid,
      username,
      phone: rawPhone,
      nickname,
      company_code,
      role = 'employee',
      is_active = 1,
    } = u;
    let phoneNorm = null;
    if (rawPhone !== undefined && rawPhone !== null && String(rawPhone).trim() !== '') {
      phoneNorm = normalizePhone(rawPhone);
      if (!phoneNorm) {
        errors.push({ raw: u, reason: 'phone 格式无效，跳过' });
        skipped++;
        continue;
      }
    }

    if (!ext_uid && !username) {
      errors.push({ raw: u, reason: 'ext_uid 和 username 均为空，跳过' });
      skipped++;
      continue;
    }
    if (!['employee', 'chef', 'admin'].includes(role)) {
      errors.push({ raw: u, reason: `无效的角色值 "${role}"` });
      skipped++;
      continue;
    }

    const company_id = company_code ? (codeToId[String(company_code).toUpperCase()] ?? null) : null;

    try {
      // 优先按 ext_uid 查，再按 username 查
      let existing = null;
      if (ext_uid) {
        const [rows] = await pool.query(
          'SELECT id, role, admin_role_id FROM users WHERE ext_uid = ?',
          [ext_uid],
        );
        if (rows.length) existing = rows[0];
      }
      if (!existing && username) {
        const un = normalizeUsername(username);
        const [rows] = await pool.query(
          'SELECT id, role, admin_role_id FROM users WHERE username = ?',
          [un],
        );
        if (rows.length) existing = rows[0];
      }

      if (existing) {
        const nextAdminRoleId = syncResolveAdminRoleId(existing.role, existing.admin_role_id, role);
        const sets = [
          'nickname       = COALESCE(NULLIF(?, \'\'), nickname)',
          'company_id     = COALESCE(?, company_id)',
          'role           = ?',
          'admin_role_id  = ?',
          'is_active      = ?',
          'ext_uid        = COALESCE(ext_uid, ?)',
          'sync_source    = ?',
          'synced_at      = ?',
        ];
        const vals = [
          nickname || '',
          company_id,
          role,
          nextAdminRoleId,
          is_active,
          ext_uid || null,
          source,
          now,
        ];
        if (phoneNorm) {
          sets.push('phone = ?');
          vals.push(phoneNorm);
        }
        vals.push(existing.id);
        await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
        updated++;
      } else {
        // 新建用户，默认密码 123456；admin_role_id 与手动创建规则一致（厨师岗 / 超管岗）
        const defaultPwd = await bcrypt.hash('123456', 10);
        const finalUsername = normalizeUsername(username) || `sync_${source}_${ext_uid}`;
        let arId = null;
        if (role === 'chef') arId = chefDefId;
        else if (role === 'admin') arId = superAdId;
        await pool.query(
          `INSERT INTO users (username, phone, password, nickname, role, company_id, admin_role_id, is_active, ext_uid, sync_source, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            finalUsername,
            phoneNorm,
            defaultPwd,
            nickname || finalUsername,
            role,
            company_id,
            arId,
            is_active,
            ext_uid || null,
            source,
            now,
          ]
        );
        created++;
      }
    } catch (e) {
      errors.push({ raw: u, reason: e.message });
      skipped++;
    }
  }

  return success(res, { created, updated, skipped, errors },
    `同步完成：新增 ${created}，更新 ${updated}，跳过 ${skipped}`);
};

// 获取用户列表
const getUsers = async (req, res) => {
  const {
    role, company_id, keyword, page = 1, page_size = 20, is_active, username, nickname, admin_role_id,
  } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);

  let where = ['1=1'];
  let params = [];
  if (role) { where.push('u.role = ?'); params.push(role); }
  if (admin_role_id !== undefined && admin_role_id !== '' && admin_role_id !== null) {
    const arid = parseInt(admin_role_id, 10);
    if (Number.isFinite(arid)) {
      where.push('u.admin_role_id = ?');
      params.push(arid);
    }
  }
  if (company_id) { where.push('u.company_id = ?'); params.push(company_id); }
  if (keyword) {
    where.push('(u.username LIKE ? OR u.nickname LIKE ? OR u.phone LIKE ?)');
    const k = `%${keyword}%`;
    params.push(k, k, k);
  }
  if (username) { where.push('u.username LIKE ?'); params.push(`%${String(username).trim()}%`); }
  if (nickname) { where.push('u.nickname LIKE ?'); params.push(`%${String(nickname).trim()}%`); }
  if (is_active !== undefined && is_active !== '' && is_active !== null) {
    where.push('u.is_active = ?');
    params.push(parseInt(is_active, 10));
  }

  const whereSql = where.join(' AND ');

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users u WHERE ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.phone, u.nickname, u.avatar, u.role, u.admin_role_id, u.company_id, u.is_active,
              u.ext_uid, u.sync_source, u.synced_at, u.created_at,
              c.name AS company_name, c.code AS company_code,
              ar.name AS admin_role_name, ar.code AS admin_role_code
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       LEFT JOIN admin_roles ar ON ar.id = u.admin_role_id
       WHERE ${whereSql}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(page_size), offset]
    );
    return success(res, { total, page: parseInt(page), page_size: parseInt(page_size), list: rows });
  } catch (err) {
    console.error('getUsers error:', err);
    return fail(res, '服务器错误', 500);
  }
};

/** 用户列表筛选用：后台岗位下拉（须能登录管理端的用户才关心） */
const listAdminRolesBrief = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, code, name FROM admin_roles ORDER BY is_system DESC, id'
    );
    return success(res, rows);
  } catch (err) {
    console.error('listAdminRolesBrief error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 创建用户（默认 users.role=employee「用户」；可选 chef/admin）
const createUser = async (req, res) => {
  const { username, password, nickname, role: rawRole, company_id, phone, admin_role_id } = req.body;
  const role = rawRole || 'employee';
  if (!username || !password) return fail(res, '登录名和密码不能为空');
  if (!['employee', 'chef', 'admin'].includes(role)) return fail(res, '无效的角色');

  const un = normalizeUsername(username);
  let phoneNorm = null;
  if (phone !== undefined && phone !== null && String(phone).trim() !== '') {
    phoneNorm = normalizePhone(phone);
    if (!phoneNorm) return fail(res, '手机号格式无效');
  }

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [un]);
    if (existing.length > 0) return fail(res, '该登录名已被使用');

    if (phoneNorm) {
      const [pDup] = await pool.query('SELECT id FROM users WHERE phone = ?', [phoneNorm]);
      if (pDup.length) return fail(res, '该手机号已被使用');
    }

    const hashed = await bcrypt.hash(password, 10);

    let arId = null;
    if (admin_role_id !== undefined && admin_role_id !== null && admin_role_id !== '') {
      const caller = await resolveUserRbac(req.user.id);
      if (!caller.permissionSet.has('rbac:assign')) {
        return fail(res, '无权分配后台岗位', 403);
      }
      arId = parseInt(admin_role_id, 10);
      const [ar] = await pool.query('SELECT code FROM admin_roles WHERE id = ?', [arId]);
      if (!ar.length) return fail(res, '无效的后台岗位', 400);
      if (ar[0].code === SUPER_ADMIN_CODE && !caller.isSuperAdmin) {
        return fail(res, '无权绑定超级管理员岗位', 403);
      }
    }

    if (role === 'chef' && arId == null) {
      const [cd] = await pool.query('SELECT id FROM admin_roles WHERE code = ?', [CHEF_DEFAULT_CODE]);
      if (cd.length) arId = cd[0].id;
    }
    if (role === 'admin' && arId == null) {
      const [sd] = await pool.query('SELECT id FROM admin_roles WHERE code = ?', [SUPER_ADMIN_CODE]);
      if (sd.length) arId = sd[0].id;
    }

    const [result] = await pool.query(
      'INSERT INTO users (username, phone, password, nickname, role, company_id, admin_role_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [un, phoneNorm, hashed, nickname || un, role, company_id || null, arId]
    );
    return success(res, { id: result.insertId }, '用户创建成功', 201);
  } catch (err) {
    console.error('createUser error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 更新用户信息
const updateUser = async (req, res) => {
  const { nickname, role, company_id, is_active, phone, admin_role_id } = req.body;
  const userId = parseInt(req.params.id, 10);

  if (parseInt(String(req.user.id), 10) === userId && (role !== undefined || is_active === 0)) {
    return fail(res, '不能修改自己的角色或禁用自己的账号');
  }

  try {
    const [existing] = await pool.query('SELECT id, role, admin_role_id FROM users WHERE id = ?', [userId]);
    if (existing.length === 0) return fail(res, '用户不存在', 404);
    const prev = existing[0];

    const fields = [];
    const params = [];
    if (nickname !== undefined) { fields.push('nickname = ?'); params.push(nickname); }
    if (role !== undefined) {
      if (!['employee', 'chef', 'admin'].includes(role)) return fail(res, '无效的角色');
      fields.push('role = ?');
      params.push(role);
      if (role === 'employee') {
        fields.push('admin_role_id = NULL');
      }
    }
    if (company_id !== undefined) { fields.push('company_id = ?'); params.push(company_id || null); }
    if (is_active !== undefined) { fields.push('is_active = ?'); params.push(parseInt(is_active, 10)); }
    if (phone !== undefined) {
      const p = String(phone || '').trim();
      if (p === '') {
        fields.push('phone = NULL');
      } else {
        const ph = normalizePhone(p);
        if (!ph) return fail(res, '手机号格式无效');
        const [pd] = await pool.query('SELECT id FROM users WHERE phone = ? AND id <> ?', [ph, userId]);
        if (pd.length) return fail(res, '该手机号已被其他用户使用');
        fields.push('phone = ?');
        params.push(ph);
      }
    }

    if (admin_role_id !== undefined && !(role !== undefined && role === 'employee')) {
      const caller = await resolveUserRbac(req.user.id);
      if (!caller.permissionSet.has('rbac:assign')) {
        return fail(res, '无权分配后台岗位', 403);
      }
      let arId = admin_role_id === null || admin_role_id === '' ? null : parseInt(admin_role_id, 10);
      if (arId !== null && !Number.isFinite(arId)) return fail(res, '无效的后台岗位', 400);
      const nextRole = role !== undefined ? role : prev.role;
      if (arId !== null && nextRole === 'employee') {
        return fail(res, '用户身份为用户时不允许绑定后台岗位', 400);
      }
      if (arId !== null) {
        const [ar] = await pool.query('SELECT code FROM admin_roles WHERE id = ?', [arId]);
        if (!ar.length) return fail(res, '无效的后台岗位', 400);
        if (ar[0].code === SUPER_ADMIN_CODE && !caller.isSuperAdmin) {
          return fail(res, '无权绑定超级管理员岗位', 403);
        }
      }
      fields.push('admin_role_id = ?');
      params.push(arId);
      await writeAudit(req.user.id, 'user_admin_role_changed', { user_id: userId, admin_role_id: arId });
    }

    if (role !== undefined && role === 'chef' && admin_role_id === undefined) {
      const curAr = prev.admin_role_id;
      if (!curAr) {
        const [cd] = await pool.query('SELECT id FROM admin_roles WHERE code = ?', [CHEF_DEFAULT_CODE]);
        if (cd.length) {
          fields.push('admin_role_id = ?');
          params.push(cd[0].id);
        }
      }
    }
    if (role !== undefined && role === 'admin' && admin_role_id === undefined) {
      const needBind = role === 'admin' && !prev.admin_role_id;
      if (needBind) {
        const [sd] = await pool.query('SELECT id FROM admin_roles WHERE code = ?', [SUPER_ADMIN_CODE]);
        if (sd.length) {
          fields.push('admin_role_id = ?');
          params.push(sd[0].id);
        }
      }
    }

    if (fields.length === 0) return fail(res, '没有需要更新的字段');

    params.push(userId);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    return success(res, null, '更新成功');
  } catch (err) {
    console.error('updateUser error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 重置用户密码
const resetUserPassword = async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) return fail(res, '新密码长度不能少于 6 位');

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return fail(res, '用户不存在', 404);

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.params.id]);
    return success(res, null, '密码重置成功');
  } catch (err) {
    console.error('resetUserPassword error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 获取公司列表（管理端用，含成员数量）
const getCompanies = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.name, c.code, c.contact_name, c.contact_phone, c.address, c.remark, c.credit_code, c.is_active, c.created_at,
              COALESCE(m.member_count, 0) AS member_count
       FROM companies c
       LEFT JOIN (
         SELECT company_id, COUNT(*) AS member_count
         FROM users
         WHERE role = 'employee'
         GROUP BY company_id
       ) m ON m.company_id = c.id
       ORDER BY c.code`
    );
    return success(res, rows);
  } catch (err) {
    console.error('getCompanies error:', err);
    return fail(res, '服务器错误', 500);
  }
};

const normStr = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

// 创建公司
const createCompany = async (req, res) => {
  const { name, code, contact_name, contact_phone, address, remark, credit_code, is_active } = req.body;
  if (!name || !code) return fail(res, '公司名称和编码不能为空');

  try {
    const codeUpper = String(code).toUpperCase();
    const [existing] = await pool.query('SELECT id FROM companies WHERE code = ?', [codeUpper]);
    if (existing.length > 0) return fail(res, '该公司编码已存在');

    const active = is_active === undefined || is_active === null ? 1 : is_active ? 1 : 0;
    const [result] = await pool.query(
      `INSERT INTO companies (name, code, contact_name, contact_phone, address, remark, credit_code, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(name).trim(),
        codeUpper,
        normStr(contact_name),
        normStr(contact_phone),
        normStr(address),
        normStr(remark),
        normStr(credit_code),
        active,
      ]
    );
    return success(res, { id: result.insertId }, '公司创建成功', 201);
  } catch (err) {
    console.error('createCompany error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 更新公司信息（未出现在 body 中的字段保持原值，便于脚本只改 name）
const updateCompany = async (req, res) => {
  const b = req.body || {};
  if (!b.name || String(b.name).trim() === '') return fail(res, '公司名称不能为空');

  try {
    const [existing] = await pool.query('SELECT * FROM companies WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return fail(res, '公司不存在', 404);
    const cur = existing[0];

    const next = {
      name: String(b.name).trim(),
      contact_name: 'contact_name' in b ? normStr(b.contact_name) : cur.contact_name,
      contact_phone: 'contact_phone' in b ? normStr(b.contact_phone) : cur.contact_phone,
      address: 'address' in b ? normStr(b.address) : cur.address,
      remark: 'remark' in b ? normStr(b.remark) : cur.remark,
      credit_code: 'credit_code' in b ? normStr(b.credit_code) : cur.credit_code,
      is_active:
        'is_active' in b ? (b.is_active ? 1 : 0) : (cur.is_active === undefined ? 1 : cur.is_active ? 1 : 0),
    };

    await pool.query(
      `UPDATE companies SET name = ?, contact_name = ?, contact_phone = ?, address = ?, remark = ?, credit_code = ?, is_active = ?
       WHERE id = ?`,
      [
        next.name,
        next.contact_name,
        next.contact_phone,
        next.address,
        next.remark,
        next.credit_code,
        next.is_active,
        req.params.id,
      ]
    );
    return success(res, null, '更新成功');
  } catch (err) {
    console.error('updateCompany error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 删除公司（仅当 role=employee 且归属该公司的用户数为 0）
const deleteCompany = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id < 1) return fail(res, '无效的公司ID', 400);

  try {
    const [empRows] = await pool.query(
      `SELECT COUNT(*) AS n FROM users WHERE company_id = ? AND role = 'employee'`,
      [id]
    );
    const n = Number(empRows[0]?.n ?? 0);
    if (n > 0) {
      return fail(
        res,
        `该公司仍有 ${n} 名员工，无法删除。请先将员工调离或删除后再操作。`,
        400
      );
    }

    const [exist] = await pool.query('SELECT id FROM companies WHERE id = ?', [id]);
    if (!exist.length) return fail(res, '公司不存在', 404);

    await pool.query('DELETE FROM companies WHERE id = ?', [id]);
    return success(res, null, '公司已删除');
  } catch (err) {
    console.error('deleteCompany error:', err);
    return fail(res, '服务器错误', 500);
  }
};

module.exports = {
  syncUsers,
  getUsers,
  listAdminRolesBrief,
  createUser,
  updateUser,
  resetUserPassword,
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
};
