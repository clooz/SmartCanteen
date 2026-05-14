const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/connection');
const { success, fail } = require('../utils/response');

// 生成 JWT Token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, company_id: user.company_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
}

// 注册（仅限 employee 角色，员工自行注册）
const register = async (req, res) => {
  const { username, password, nickname, company_id } = req.body;

  if (!username || !password) {
    return fail(res, '用户名和密码不能为空');
  }
  if (username.length < 3 || username.length > 50) {
    return fail(res, '用户名长度需在 3-50 个字符之间');
  }
  if (password.length < 6) {
    return fail(res, '密码长度不能少于 6 位');
  }
  if (!company_id) {
    return fail(res, '请选择所属公司');
  }

  try {
    // 检查用户名是否已存在
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return fail(res, '该用户名已被注册');
    }

    // 检查公司是否存在
    const [company] = await pool.query('SELECT id FROM companies WHERE id = ?', [company_id]);
    if (company.length === 0) {
      return fail(res, '所选公司不存在');
    }

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password, nickname, role, company_id) VALUES (?, ?, ?, "employee", ?)',
      [username, hashed, nickname || username, company_id]
    );

    return success(res, { id: result.insertId }, '注册成功', 201);
  } catch (err) {
    console.error('register error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 登录（所有角色通用）
const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return fail(res, '用户名和密码不能为空');
  }

  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.password, u.nickname, u.avatar, u.role, u.company_id, u.is_active,
              c.name AS company_name, c.code AS company_code
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.username = ?`,
      [username]
    );

    if (rows.length === 0) {
      return fail(res, '用户名或密码错误');
    }

    const user = rows[0];

    if (!user.is_active) {
      return fail(res, '账号已被禁用，请联系管理员');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return fail(res, '用户名或密码错误');
    }

    const token = generateToken(user);

    return success(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        role: user.role,
        company_id: user.company_id,
        company_name: user.company_name,
        company_code: user.company_code,
      },
    }, '登录成功');
  } catch (err) {
    console.error('login error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 获取当前用户信息
const getProfile = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.nickname, u.avatar, u.role, u.company_id, u.created_at,
              c.name AS company_name, c.code AS company_code
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return fail(res, '用户不存在', 404);
    }

    return success(res, rows[0]);
  } catch (err) {
    console.error('getProfile error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 修改个人信息（昵称、头像 URL，可只传其一）
const updateProfile = async (req, res) => {
  const { nickname, avatar } = req.body;

  const fields = [];
  const params = [];

  if (nickname !== undefined) {
    const n = String(nickname).trim();
    if (!n) return fail(res, '昵称不能为空');
    if (n.length > 50) return fail(res, '昵称不超过50字');
    fields.push('nickname = ?');
    params.push(n);
  }

  if (avatar !== undefined) {
    const a = String(avatar || '').trim();
    if (a.length > 255) return fail(res, '头像地址无效');
    fields.push('avatar = ?');
    params.push(a || null);
  }

  if (fields.length === 0) {
    return fail(res, '没有要修改的内容');
  }

  try {
    params.push(req.user.id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    return success(res, null, '更新成功');
  } catch (err) {
    console.error('updateProfile error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 上传头像（multipart，字段名 avatar）
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return fail(res, '请选择图片');
    }
    const url = `/uploads/${req.file.filename}`;
    await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [url, req.user.id]);
    return success(res, { avatar: url }, '头像已更新');
  } catch (err) {
    if (err.message && err.message.includes('仅支持')) {
      return fail(res, err.message);
    }
    console.error('uploadAvatar error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 修改密码
const changePassword = async (req, res) => {
  const { old_password, new_password } = req.body;

  if (!old_password || !new_password) {
    return fail(res, '旧密码和新密码不能为空');
  }
  if (new_password.length < 6) {
    return fail(res, '新密码长度不能少于 6 位');
  }

  try {
    const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const isMatch = await bcrypt.compare(old_password, rows[0].password);
    if (!isMatch) {
      return fail(res, '旧密码不正确');
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

    return success(res, null, '密码修改成功');
  } catch (err) {
    console.error('changePassword error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 获取公司列表（注册时选择用）
const getCompanies = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, code FROM companies ORDER BY code');
    return success(res, rows);
  } catch (err) {
    console.error('getCompanies error:', err);
    return fail(res, '服务器错误', 500);
  }
};

module.exports = { register, login, getProfile, updateProfile, uploadAvatar, changePassword, getCompanies };
