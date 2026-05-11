const { pool } = require('../db/connection');
const { success, fail } = require('../utils/response');

// 用户提交充值申请
const createRecharge = async (req, res) => {
  const { amount, remark } = req.body;
  const proof_image_url = req.file ? `/uploads/${req.file.filename}` : '';

  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    return fail(res, '请填写正确的充值金额');
  }
  if (!proof_image_url) {
    return fail(res, '请上传转账凭证图片');
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO recharge_records (user_id, amount, proof_image_url, remark) VALUES (?, ?, ?, ?)',
      [req.user.id, parseFloat(amount).toFixed(2), proof_image_url, remark || '']
    );
    return success(res, { id: result.insertId }, '充值申请已提交，请等待管理员处理', 201);
  } catch (err) {
    console.error('createRecharge error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 用户查看自己的充值记录
const getMyRecharges = async (req, res) => {
  const { page = 1, page_size = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);

  try {
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM recharge_records WHERE user_id = ?',
      [req.user.id]
    );
    const [rows] = await pool.query(
      `SELECT r.*, u.nickname AS reviewer_name
       FROM recharge_records r
       LEFT JOIN users u ON r.reviewed_by = u.id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, parseInt(page_size), offset]
    );
    return success(res, { total, page: parseInt(page), page_size: parseInt(page_size), list: rows });
  } catch (err) {
    console.error('getMyRecharges error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 管理员获取所有充值申请（支持按状态筛选）
const getAllRecharges = async (req, res) => {
  const { status, page = 1, page_size = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);

  let where = ['1=1'];
  let params = [];
  if (status) { where.push('r.status = ?'); params.push(status); }

  const whereSql = where.join(' AND ');

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM recharge_records r WHERE ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT r.*,
              u.nickname AS user_name, u.username,
              c.name AS company_name,
              rv.nickname AS reviewer_name
       FROM recharge_records r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN companies c ON u.company_id = c.id
       LEFT JOIN users rv ON r.reviewed_by = rv.id
       WHERE ${whereSql}
       ORDER BY
         CASE r.status WHEN 'pending' THEN 0 ELSE 1 END,
         r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(page_size), offset]
    );
    return success(res, { total, page: parseInt(page), page_size: parseInt(page_size), list: rows });
  } catch (err) {
    console.error('getAllRecharges error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 管理员处理充值申请（标记已完成或驳回）
const reviewRecharge = async (req, res) => {
  const { status, review_note } = req.body;
  const recordId = req.params.id;

  if (!['completed', 'rejected'].includes(status)) {
    return fail(res, '无效的状态，只能设置为 completed 或 rejected');
  }

  try {
    const [existing] = await pool.query(
      'SELECT id, status FROM recharge_records WHERE id = ?',
      [recordId]
    );
    if (existing.length === 0) return fail(res, '充值记录不存在', 404);
    if (existing[0].status !== 'pending') return fail(res, '该申请已处理，无法重复操作');

    await pool.query(
      `UPDATE recharge_records
       SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [status, review_note || '', req.user.id, recordId]
    );

    const msg = status === 'completed' ? '已标记为充值完成' : '已驳回该充值申请';
    return success(res, null, msg);
  } catch (err) {
    console.error('reviewRecharge error:', err);
    return fail(res, '服务器错误', 500);
  }
};

module.exports = { createRecharge, getMyRecharges, getAllRecharges, reviewRecharge };
