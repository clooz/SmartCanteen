const bcrypt = require('bcryptjs');
const { pool } = require('../db/connection');

const PURPOSES = new Set(['login', 'bind_phone', 'forgot_sms', 'forgot_email']);

function isSmsFixedMode() {
  return String(process.env.SMS_USE_FIXED || '1').trim() === '1';
}

function getFixedSmsCode() {
  return String(process.env.SMS_FIXED_CODE || '123456').trim();
}

function isEmailFixedMode() {
  return String(process.env.EMAIL_USE_FIXED || '1').trim() === '1';
}

function getFixedEmailCode() {
  return String(process.env.EMAIL_FIXED_CODE || '123456').trim();
}

/** 中国大陆 11 位手机号 */
function normalizePhone(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (digits.length === 11 && /^1\d{10}$/.test(digits)) return digits;
  return null;
}

function normalizeEmail(input) {
  const s = String(input || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}

function maskPhone(phone) {
  if (!phone || phone.length < 7) return '';
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

async function assertSendRateLimit(target, channel, purpose) {
  const [rows] = await pool.query(
    `SELECT created_at FROM sms_verifications
     WHERE target = ? AND channel = ? AND purpose = ?
     ORDER BY id DESC LIMIT 1`,
    [target, channel, purpose]
  );
  if (!rows.length) return;
  const last = new Date(rows[0].created_at).getTime();
  if (Date.now() - last < 60 * 1000) {
    const err = new Error('发送过于频繁，请稍后再试');
    err.status = 429;
    throw err;
  }
}

async function countToday(target, channel, purpose) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM sms_verifications
     WHERE target = ? AND channel = ? AND purpose = ?
       AND created_at >= CURDATE()`,
    [target, channel, purpose]
  );
  return rows[0].n || 0;
}

/**
 * 发送验证码（写入库或固定码模式仅走限频）
 * @returns {{ devPlainCode?: string }} 开发环境可返回明文（日志用）
 */
async function sendVerificationCode({ target, channel, purpose }) {
  if (!PURPOSES.has(purpose)) {
    const err = new Error('无效的验证码用途');
    err.status = 400;
    throw err;
  }
  await assertSendRateLimit(target, channel, purpose);
  const daily = parseInt(process.env.SMS_DAILY_LIMIT_PER_TARGET || '20', 10);
  const today = await countToday(target, channel, purpose);
  if (today >= daily) {
    const err = new Error('今日验证码次数已达上限');
    err.status = 429;
    throw err;
  }

  const useFixed =
    (channel === 'sms' && isSmsFixedMode()) || (channel === 'email' && isEmailFixedMode());
  const plain = useFixed
    ? channel === 'sms'
      ? getFixedSmsCode()
      : getFixedEmailCode()
    : String(100000 + Math.floor(Math.random() * 900000));

  const codeHash = await bcrypt.hash(plain, 10);
  const expires = new Date(Date.now() + 5 * 60 * 1000);
  await pool.query(
    `INSERT INTO sms_verifications (target, channel, purpose, code_hash, expires_at) VALUES (?,?,?,?,?)`,
    [target, channel, purpose, codeHash, expires]
  );

  if (channel === 'email' && process.env.NODE_ENV !== 'production') {
    console.log(`[EMAIL DEV] 验证码 → ${target}: ${plain}`);
  }
  return { devPlainCode: process.env.NODE_ENV !== 'production' ? plain : undefined };
}

async function verifyCode({ target, channel, purpose, code }) {
  if (!code) return false;
  if (
    (channel === 'sms' && isSmsFixedMode() && code === getFixedSmsCode()) ||
    (channel === 'email' && isEmailFixedMode() && code === getFixedEmailCode())
  ) {
    return true;
  }
  const [rows] = await pool.query(
    `SELECT id, code_hash FROM sms_verifications
     WHERE target = ? AND channel = ? AND purpose = ?
     ORDER BY id DESC LIMIT 5`,
    [target, channel, purpose]
  );
  const now = Date.now();
  for (const row of rows) {
    const exp = new Date(row.expires_at).getTime();
    if (exp < now) continue;
    const ok = await bcrypt.compare(String(code), row.code_hash);
    if (ok) {
      await pool.query('DELETE FROM sms_verifications WHERE id = ?', [row.id]);
      return true;
    }
  }
  return false;
}

module.exports = {
  normalizePhone,
  normalizeEmail,
  maskPhone,
  sendVerificationCode,
  verifyCode,
  isSmsFixedMode,
  getFixedSmsCode,
  PURPOSES,
};
