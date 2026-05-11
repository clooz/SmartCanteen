const bcrypt = require('bcryptjs');
const { pool } = require('../db/connection');
const { success, fail } = require('../utils/response');

// 获取用户列表
const getUsers = async (req, res) => {
  const { role, company_id, keyword, page = 1, page_size = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);

  let where = ['1=1'];
  let params = [];
  if (role) { where.push('u.role = ?'); params.push(role); }
  if (company_id) { where.push('u.company_id = ?'); params.push(company_id); }
  if (keyword) { where.push('(u.username LIKE ? OR u.nickname LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }

  const whereSql = where.join(' AND ');

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users u WHERE ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.nickname, u.avatar, u.role, u.company_id, u.is_active, u.created_at,
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

module.exports = { getUsers, createUser, updateUser, resetUserPassword, getCompanies, createCompany, updateCompany };
