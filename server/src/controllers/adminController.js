const bcrypt = require('bcryptjs');
const { pool } = require('../db/connection');
const { success, fail } = require('../utils/response');

/**
 * 批量同步/导入用户（外部工作平台对接入口）
 *
 * POST /admin/users/sync
 * Body: {
 *   source: 'dingtalk' | 'wecom' | 'feishu' | 'hr' | string,  // 来源标识
 *   users: [{
 *     ext_uid:      string,   // 外部平台唯一ID（首选匹配键）
 *     username:     string,   // 本系统用户名/手机号（ext_uid 缺失时匹配用）
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

  for (const u of users) {
    const { ext_uid, username, nickname, company_code, role = 'employee', is_active = 1 } = u;

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
        const [rows] = await pool.query('SELECT id FROM users WHERE ext_uid = ?', [ext_uid]);
        if (rows.length) existing = rows[0];
      }
      if (!existing && username) {
        const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
        if (rows.length) existing = rows[0];
      }

      if (existing) {
        // 更新已有用户（不覆盖密码）
        await pool.query(
          `UPDATE users SET
             nickname    = COALESCE(NULLIF(?, ''), nickname),
             company_id  = COALESCE(?, company_id),
             role        = ?,
             is_active   = ?,
             ext_uid     = COALESCE(ext_uid, ?),
             sync_source = ?,
             synced_at   = ?
           WHERE id = ?`,
          [nickname || '', company_id, role, is_active,
           ext_uid || null, source, now, existing.id]
        );
        updated++;
      } else {
        // 新建用户，默认密码 123456
        const defaultPwd = await bcrypt.hash('123456', 10);
        const finalUsername = username || `sync_${source}_${ext_uid}`;
        await pool.query(
          `INSERT INTO users (username, password, nickname, role, company_id, is_active, ext_uid, sync_source, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [finalUsername, defaultPwd, nickname || finalUsername,
           role, company_id, is_active, ext_uid || null, source, now]
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
  const { role, company_id, keyword, page = 1, page_size = 20, is_active, username, nickname } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);

  let where = ['1=1'];
  let params = [];
  if (role) { where.push('u.role = ?'); params.push(role); }
  if (company_id) { where.push('u.company_id = ?'); params.push(company_id); }
  if (keyword) { where.push('(u.username LIKE ? OR u.nickname LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
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
      `SELECT u.id, u.username, u.nickname, u.avatar, u.role, u.company_id, u.is_active,
              u.ext_uid, u.sync_source, u.synced_at, u.created_at,
              c.name AS company_name, c.code AS company_code
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
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

// 创建用户（管理员手动创建厨师/管理员账号）
const createUser = async (req, res) => {
  const { username, password, nickname, role, company_id } = req.body;
  if (!username || !password || !role) return fail(res, '用户名、密码和角色不能为空');
  if (!['employee', 'chef', 'admin'].includes(role)) return fail(res, '无效的角色');

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) return fail(res, '该用户名已被注册');

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password, nickname, role, company_id) VALUES (?, ?, ?, ?, ?)',
      [username, hashed, nickname || username, role, company_id || null]
    );
    return success(res, { id: result.insertId }, '用户创建成功', 201);
  } catch (err) {
    console.error('createUser error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 更新用户信息
const updateUser = async (req, res) => {
  const { nickname, role, company_id, is_active } = req.body;
  const userId = req.params.id;

  // 不允许修改自己的角色/状态（防止自锁）
  if (parseInt(userId) === req.user.id && (role !== undefined || is_active === 0)) {
    return fail(res, '不能修改自己的角色或禁用自己的账号');
  }

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (existing.length === 0) return fail(res, '用户不存在', 404);

    const fields = [];
    const params = [];
    if (nickname !== undefined) { fields.push('nickname = ?'); params.push(nickname); }
    if (role !== undefined) { fields.push('role = ?'); params.push(role); }
    if (company_id !== undefined) { fields.push('company_id = ?'); params.push(company_id || null); }
    if (is_active !== undefined) { fields.push('is_active = ?'); params.push(parseInt(is_active)); }

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
      `SELECT c.*, COUNT(u.id) AS member_count
       FROM companies c
       LEFT JOIN users u ON u.company_id = c.id AND u.role = 'employee'
       GROUP BY c.id
       ORDER BY c.code`
    );
    return success(res, rows);
  } catch (err) {
    console.error('getCompanies error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 创建公司
const createCompany = async (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) return fail(res, '公司名称和编码不能为空');

  try {
    const [existing] = await pool.query('SELECT id FROM companies WHERE code = ?', [code]);
    if (existing.length > 0) return fail(res, '该公司编码已存在');

    const [result] = await pool.query(
      'INSERT INTO companies (name, code) VALUES (?, ?)',
      [name, code.toUpperCase()]
    );
    return success(res, { id: result.insertId }, '公司创建成功', 201);
  } catch (err) {
    console.error('createCompany error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 更新公司信息
const updateCompany = async (req, res) => {
  const { name } = req.body;
  if (!name) return fail(res, '公司名称不能为空');

  try {
    const [existing] = await pool.query('SELECT id FROM companies WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return fail(res, '公司不存在', 404);

    await pool.query('UPDATE companies SET name = ? WHERE id = ?', [name, req.params.id]);
    return success(res, null, '更新成功');
  } catch (err) {
    console.error('updateCompany error:', err);
    return fail(res, '服务器错误', 500);
  }
};

module.exports = { syncUsers, getUsers, createUser, updateUser, resetUserPassword, getCompanies, createCompany, updateCompany };
