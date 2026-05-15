const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/connection');
const { success, fail } = require('../utils/response');
const { resolveUserRbac } = require('../services/rbacService');
const {
  normalizePhone,
  normalizeEmail,
  maskPhone,
  sendVerificationCode,
  verifyCode,
} = require('../services/smsService');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, company_id: user.company_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    avatar: row.avatar,
    role: row.role,
    company_id: row.company_id,
    company_name: row.company_name,
    company_code: row.company_code,
    has_phone: Boolean(row.phone),
    phone_masked: row.phone ? maskPhone(row.phone) : '',
    admin_role_id: row.admin_role_id != null ? row.admin_role_id : null,
    admin_role_code: row.admin_role_code || null,
  };
}

async function enrichConsoleUserPayload(row) {
  const base = publicUser(row);
  if (row.role !== 'chef' && row.role !== 'admin') {
    return { ...base, permissions: [], is_super_admin: false };
  }
  const rbac = await resolveUserRbac(row.id);
  return {
    ...base,
    permissions: Array.from(rbac.permissionSet),
    is_super_admin: rbac.isSuperAdmin,
  };
}

const registerDisabled = async (req, res) =>
  fail(res, '请联系管理员分配账号，不支持自助注册', 403);

const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return fail(res, '账号和密码不能为空');
  }

  const raw = String(username).trim();
  const ph = normalizePhone(raw);
  const emailGuess = raw.includes('@') ? normalizeEmail(raw) : null;

  try {
    let rows;
    if (ph) {
      [rows] = await pool.query(
        `SELECT u.id, u.username, u.password, u.phone, u.nickname, u.avatar, u.role, u.company_id, u.is_active,
                u.admin_role_id, ar.code AS admin_role_code,
                c.name AS company_name, c.code AS company_code
         FROM users u
         LEFT JOIN companies c ON u.company_id = c.id
         LEFT JOIN admin_roles ar ON ar.id = u.admin_role_id
         WHERE u.phone = ? OR LOWER(TRIM(u.username)) = LOWER(?)`,
        [ph, raw]
      );
    } else {
      const key = emailGuess || raw;
      [rows] = await pool.query(
        `SELECT u.id, u.username, u.password, u.phone, u.nickname, u.avatar, u.role, u.company_id, u.is_active,
                u.admin_role_id, ar.code AS admin_role_code,
                c.name AS company_name, c.code AS company_code
         FROM users u
         LEFT JOIN companies c ON u.company_id = c.id
         LEFT JOIN admin_roles ar ON ar.id = u.admin_role_id
         WHERE LOWER(TRIM(u.username)) = LOWER(?)`,
        [key]
      );
    }

    if (rows.length === 0) {
      return fail(res, '账号或密码错误');
    }

    const user = rows[0];

    if (!user.is_active) {
      return fail(res, '账号已被禁用，请联系管理员');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return fail(res, '账号或密码错误');
    }

    const token = generateToken(user);
    const userPayload = await enrichConsoleUserPayload(user);

    return success(res, {
      token,
      user: userPayload,
    }, '登录成功');
  } catch (err) {
    console.error('login error:', err);
    return fail(res, '服务器错误', 500);
  }
};

const sendSmsCode = async (req, res) => {
  const { phone, purpose = 'login' } = req.body;
  const ph = normalizePhone(phone);
  if (!ph) return fail(res, '请输入正确的手机号');

  const allowed = new Set(['login', 'forgot_sms']);
  if (!allowed.has(purpose)) return fail(res, '无效的用途');

  try {
    if (purpose === 'login') {
      const [u] = await pool.query(
        'SELECT id FROM users WHERE phone = ? AND is_active = 1',
        [ph]
      );
      if (!u.length) {
        return fail(res, '该手机号未开通，请使用邮箱登录后在个人中心绑定手机，或联系管理员');
      }
    }
    if (purpose === 'forgot_sms') {
      const [u] = await pool.query(
        'SELECT id FROM users WHERE phone = ? AND is_active = 1',
        [ph]
      );
      if (!u.length) return fail(res, '该手机号未绑定任何账号');
    }

    await sendVerificationCode({ target: ph, channel: 'sms', purpose });
    return success(res, { sent: true }, '验证码已发送');
  } catch (e) {
    if (e.status === 429) return fail(res, e.message, 429);
    console.error('sendSmsCode error:', e);
    return fail(res, e.message || '发送失败', 500);
  }
};

const loginSms = async (req, res) => {
  const { phone, code } = req.body;
  const ph = normalizePhone(phone);
  if (!ph || !code) return fail(res, '请输入手机号和验证码');

  try {
    const ok = await verifyCode({ target: ph, channel: 'sms', purpose: 'login', code });
    if (!ok) return fail(res, '验证码错误或已过期');

    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.password, u.phone, u.nickname, u.avatar, u.role, u.company_id, u.is_active,
              u.admin_role_id, ar.code AS admin_role_code,
              c.name AS company_name, c.code AS company_code
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       LEFT JOIN admin_roles ar ON ar.id = u.admin_role_id
       WHERE u.phone = ?`,
      [ph]
    );
    if (!rows.length) return fail(res, '该手机号未开通');
    const user = rows[0];
    if (!user.is_active) return fail(res, '账号已被禁用，请联系管理员');

    const token = generateToken(user);
    const userPayload = await enrichConsoleUserPayload(user);
    return success(res, { token, user: userPayload }, '登录成功');
  } catch (err) {
    console.error('loginSms error:', err);
    return fail(res, '服务器错误', 500);
  }
};

const getProfile = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.phone, u.nickname, u.avatar, u.role, u.company_id, u.created_at,
              u.admin_role_id, ar.code AS admin_role_code,
              c.name AS company_name, c.code AS company_code
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       LEFT JOIN admin_roles ar ON ar.id = u.admin_role_id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return fail(res, '用户不存在', 404);
    }

    const row = rows[0];
    const data = await enrichConsoleUserPayload(row);
    data.created_at = row.created_at;
    return success(res, data);
  } catch (err) {
    console.error('getProfile error:', err);
    return fail(res, '服务器错误', 500);
  }
};

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

const getCompanies = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, code FROM companies WHERE is_active = 1 ORDER BY code'
    );
    return success(res, rows);
  } catch (err) {
    console.error('getCompanies error:', err);
    return fail(res, '服务器错误', 500);
  }
};

const getLegalVersion = async (req, res) => {
  return success(res, { version: String(process.env.LEGAL_VERSION || '1').trim() });
};

const bindPhone = async (req, res) => {
  const { phone, code } = req.body;
  const ph = normalizePhone(phone);
  if (!ph || !code) return fail(res, '请输入手机号和验证码');

  try {
    const ok = await verifyCode({ target: ph, channel: 'sms', purpose: 'bind_phone', code });
    if (!ok) return fail(res, '验证码错误或已过期');

    const [dup] = await pool.query('SELECT id FROM users WHERE phone = ? AND id <> ?', [
      ph,
      req.user.id,
    ]);
    if (dup.length) return fail(res, '该手机号已被其他账号绑定');

    await pool.query('UPDATE users SET phone = ? WHERE id = ?', [ph, req.user.id]);
    return success(res, null, '绑定成功');
  } catch (err) {
    console.error('bindPhone error:', err);
    return fail(res, '服务器错误', 500);
  }
};

/** 登录态：发送绑定手机验证码 */
const sendBindPhoneCode = async (req, res) => {
  const { phone } = req.body;
  const ph = normalizePhone(phone);
  if (!ph) return fail(res, '请输入正确的手机号');

  try {
    const [dup] = await pool.query('SELECT id FROM users WHERE phone = ? AND id <> ?', [
      ph,
      req.user.id,
    ]);
    if (dup.length) return fail(res, '该手机号已被其他账号使用');

    await sendVerificationCode({ target: ph, channel: 'sms', purpose: 'bind_phone' });
    return success(res, { sent: true }, '验证码已发送');
  } catch (e) {
    if (e.status === 429) return fail(res, e.message, 429);
    console.error('sendBindPhoneCode error:', e);
    return fail(res, e.message || '发送失败', 500);
  }
};

const forgotSmsSend = async (req, res) => {
  const { phone } = req.body;
  const ph = normalizePhone(phone);
  if (!ph) return fail(res, '请输入正确的手机号');

  try {
    const [u] = await pool.query(
      'SELECT id FROM users WHERE phone = ? AND is_active = 1',
      [ph]
    );
    if (!u.length) return fail(res, '该手机号未绑定任何账号');

    await sendVerificationCode({ target: ph, channel: 'sms', purpose: 'forgot_sms' });
    return success(res, { sent: true }, '验证码已发送');
  } catch (e) {
    if (e.status === 429) return fail(res, e.message, 429);
    console.error('forgotSmsSend error:', e);
    return fail(res, e.message || '发送失败', 500);
  }
};

const forgotSmsReset = async (req, res) => {
  const { phone, code, new_password } = req.body;
  const ph = normalizePhone(phone);
  if (!ph || !code || !new_password) return fail(res, '请填写完整信息');
  if (new_password.length < 6) return fail(res, '新密码至少6位');

  try {
    const ok = await verifyCode({ target: ph, channel: 'sms', purpose: 'forgot_sms', code });
    if (!ok) return fail(res, '验证码错误或已过期');

    const [rows] = await pool.query(
      'SELECT id FROM users WHERE phone = ? AND is_active = 1',
      [ph]
    );
    if (!rows.length) return fail(res, '用户不存在');

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, rows[0].id]);
    return success(res, null, '密码已重置，请使用新密码登录');
  } catch (err) {
    console.error('forgotSmsReset error:', err);
    return fail(res, '服务器错误', 500);
  }
};

const forgotEmailSend = async (req, res) => {
  const { email } = req.body;
  const em = normalizeEmail(email);
  if (!em) return fail(res, '请输入正确的邮箱');

  try {
    const [u] = await pool.query(
      'SELECT id FROM users WHERE LOWER(TRIM(username)) = ? AND is_active = 1',
      [em]
    );
    if (!u.length) return fail(res, '该邮箱未注册');

    await sendVerificationCode({ target: em, channel: 'email', purpose: 'forgot_email' });
    return success(res, { sent: true }, '验证码已发送，请查收邮箱（开发环境见服务端日志）');
  } catch (e) {
    if (e.status === 429) return fail(res, e.message, 429);
    console.error('forgotEmailSend error:', e);
    return fail(res, e.message || '发送失败', 500);
  }
};

const forgotEmailReset = async (req, res) => {
  const { email, code, new_password } = req.body;
  const em = normalizeEmail(email);
  if (!em || !code || !new_password) return fail(res, '请填写完整信息');
  if (new_password.length < 6) return fail(res, '新密码至少6位');

  try {
    const ok = await verifyCode({ target: em, channel: 'email', purpose: 'forgot_email', code });
    if (!ok) return fail(res, '验证码错误或已过期');

    const [rows] = await pool.query(
      'SELECT id FROM users WHERE LOWER(TRIM(username)) = ? AND is_active = 1',
      [em]
    );
    if (!rows.length) return fail(res, '用户不存在');

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, rows[0].id]);
    return success(res, null, '密码已重置，请使用新密码登录');
  } catch (err) {
    console.error('forgotEmailReset error:', err);
    return fail(res, '服务器错误', 500);
  }
};

module.exports = {
  register: registerDisabled,
  login,
  sendSmsCode,
  loginSms,
  getProfile,
  updateProfile,
  uploadAvatar,
  changePassword,
  getCompanies,
  getLegalVersion,
  bindPhone,
  sendBindPhoneCode,
  forgotSmsSend,
  forgotSmsReset,
  forgotEmailSend,
  forgotEmailReset,
};
