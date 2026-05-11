const { pool } = require('../db/connection');
const { success, fail } = require('../utils/response');

// ───────── 许愿活动 ─────────

// 获取活动列表
const getActivities = async (req, res) => {
  const { status } = req.query;
  let where = ['1=1'];
  let params = [];
  if (status) { where.push('wa.status = ?'); params.push(status); }

  try {
    const [rows] = await pool.query(
      `SELECT wa.*, u.nickname AS creator_name,
              (SELECT COUNT(*) FROM wish_items wi WHERE wi.activity_id = wa.id) AS item_count
       FROM wish_activities wa
       LEFT JOIN users u ON wa.created_by = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY wa.created_at DESC`,
      params
    );

    // 自动关闭已过截止时间的活动
    const now = new Date();
    for (const row of rows) {
      if (row.status === 'active' && new Date(row.end_at) < now) {
        await pool.query("UPDATE wish_activities SET status = 'closed' WHERE id = ?", [row.id]);
        row.status = 'closed';
      }
    }

    return success(res, rows);
  } catch (err) {
    console.error('getActivities error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 创建许愿活动（管理员/厨师）
const createActivity = async (req, res) => {
  const { title, description, start_at, end_at } = req.body;
  if (!title || !start_at || !end_at) return fail(res, '标题、开始时间和截止时间不能为空');
  if (new Date(end_at) <= new Date(start_at)) return fail(res, '截止时间必须晚于开始时间');

  try {
    const [result] = await pool.query(
      'INSERT INTO wish_activities (title, description, start_at, end_at, created_by) VALUES (?, ?, ?, ?, ?)',
      [title, description || '', start_at, end_at, req.user.id]
    );
    return success(res, { id: result.insertId }, '活动创建成功', 201);
  } catch (err) {
    console.error('createActivity error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 关闭活动（管理员/厨师）
const closeActivity = async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT id FROM wish_activities WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return fail(res, '活动不存在', 404);

    await pool.query("UPDATE wish_activities SET status = 'closed' WHERE id = ?", [req.params.id]);
    return success(res, null, '活动已关闭');
  } catch (err) {
    console.error('closeActivity error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// ───────── 许愿条目 ─────────

// 获取某活动的愿望列表（按票数排序）
const getWishItems = async (req, res) => {
  const activityId = req.params.activity_id;

  try {
    const [activity] = await pool.query('SELECT id FROM wish_activities WHERE id = ?', [activityId]);
    if (activity.length === 0) return fail(res, '活动不存在', 404);

    const [rows] = await pool.query(
      `SELECT wi.*, u.nickname AS user_name,
              EXISTS(
                SELECT 1 FROM wish_votes wv
                WHERE wv.wish_item_id = wi.id AND wv.user_id = ?
              ) AS has_voted
       FROM wish_items wi
       LEFT JOIN users u ON wi.user_id = u.id
       WHERE wi.activity_id = ?
       ORDER BY wi.vote_count DESC, wi.created_at ASC`,
      [req.user.id, activityId]
    );

    return success(res, rows);
  } catch (err) {
    console.error('getWishItems error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 提交许愿（员工）
const createWishItem = async (req, res) => {
  const activityId = req.params.activity_id;
  const { dish_name, description } = req.body;

  if (!dish_name) return fail(res, '请填写想吃的菜名');

  try {
    const [activity] = await pool.query(
      "SELECT id FROM wish_activities WHERE id = ? AND status = 'active'",
      [activityId]
    );
    if (activity.length === 0) return fail(res, '活动不存在或已结束');

    // 每人每次活动最多提交 3 个愿望
    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) AS count FROM wish_items WHERE activity_id = ? AND user_id = ?',
      [activityId, req.user.id]
    );
    if (count >= 3) return fail(res, '每次活动最多提交 3 个愿望');

    const [result] = await pool.query(
      'INSERT INTO wish_items (activity_id, user_id, dish_name, description) VALUES (?, ?, ?, ?)',
      [activityId, req.user.id, dish_name, description || '']
    );
    return success(res, { id: result.insertId }, '许愿成功', 201);
  } catch (err) {
    console.error('createWishItem error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 给愿望投票（员工，每人每条仅限一票）
const voteWishItem = async (req, res) => {
  const wishItemId = req.params.item_id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 检查愿望是否存在且活动进行中
    const [items] = await conn.query(
      `SELECT wi.id, wa.status AS activity_status
       FROM wish_items wi
       JOIN wish_activities wa ON wi.activity_id = wa.id
       WHERE wi.id = ?`,
      [wishItemId]
    );
    if (items.length === 0) {
      await conn.rollback();
      return fail(res, '愿望不存在', 404);
    }
    if (items[0].activity_status !== 'active') {
      await conn.rollback();
      return fail(res, '活动已结束，无法投票');
    }

    // 检查是否已投过票（UNIQUE KEY 会报错，这里主动检查更友好）
    const [existingVote] = await conn.query(
      'SELECT id FROM wish_votes WHERE wish_item_id = ? AND user_id = ?',
      [wishItemId, req.user.id]
    );
    if (existingVote.length > 0) {
      await conn.rollback();
      return fail(res, '你已经投过票了');
    }

    await conn.query(
      'INSERT INTO wish_votes (wish_item_id, user_id) VALUES (?, ?)',
      [wishItemId, req.user.id]
    );
    await conn.query(
      'UPDATE wish_items SET vote_count = vote_count + 1 WHERE id = ?',
      [wishItemId]
    );

    await conn.commit();
    return success(res, null, '投票成功');
  } catch (err) {
    await conn.rollback();
    console.error('voteWishItem error:', err);
    return fail(res, '服务器错误', 500);
  } finally {
    conn.release();
  }
};

// 取消投票
const unvoteWishItem = async (req, res) => {
  const wishItemId = req.params.item_id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existingVote] = await conn.query(
      'SELECT id FROM wish_votes WHERE wish_item_id = ? AND user_id = ?',
      [wishItemId, req.user.id]
    );
    if (existingVote.length === 0) {
      await conn.rollback();
      return fail(res, '你尚未投票');
    }

    await conn.query(
      'DELETE FROM wish_votes WHERE wish_item_id = ? AND user_id = ?',
      [wishItemId, req.user.id]
    );
    await conn.query(
      'UPDATE wish_items SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = ?',
      [wishItemId]
    );

    await conn.commit();
    return success(res, null, '已取消投票');
  } catch (err) {
    await conn.rollback();
    console.error('unvoteWishItem error:', err);
    return fail(res, '服务器错误', 500);
  } finally {
    conn.release();
  }
};

// 采纳愿望（管理员/厨师）：将愿望菜品加入菜品库
const adoptWishItem = async (req, res) => {
  const wishItemId = req.params.item_id;
  const { price, category, description } = req.body;

  if (!price) return fail(res, '请设定菜品价格');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [items] = await conn.query('SELECT * FROM wish_items WHERE id = ?', [wishItemId]);
    if (items.length === 0) {
      await conn.rollback();
      return fail(res, '愿望不存在', 404);
    }
    if (items[0].is_adopted) {
      await conn.rollback();
      return fail(res, '该愿望已被采纳');
    }

    const item = items[0];

    // 创建新菜品
    const [dishResult] = await conn.query(
      'INSERT INTO dishes (name, description, price, category) VALUES (?, ?, ?, ?)',
      [item.dish_name, description || item.description || '', parseFloat(price), category || '其他']
    );
    const dishId = dishResult.insertId;

    // 标记愿望为已采纳
    await conn.query(
      'UPDATE wish_items SET is_adopted = 1, adopted_dish_id = ? WHERE id = ?',
      [dishId, wishItemId]
    );

    await conn.commit();
    return success(res, { dish_id: dishId }, '采纳成功，菜品已加入菜品库');
  } catch (err) {
    await conn.rollback();
    console.error('adoptWishItem error:', err);
    return fail(res, '服务器错误', 500);
  } finally {
    conn.release();
  }
};

module.exports = { getActivities, createActivity, closeActivity, getWishItems, createWishItem, voteWishItem, unvoteWishItem, adoptWishItem };
