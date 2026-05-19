const { pool } = require('../db/connection');
const { success, fail } = require('../utils/response');
const { getKitchenOrderingSettings } = require('../services/kitchenOrderingSettings');
const {
  buildOrderingSummary,
  normalizeTimeForDb,
  normalizeOverride,
  localDateStr,
} = require('../utils/orderingRules');

// 获取某日菜单（含菜品列表）
// 员工端仅展示「已发布」；管理端可查看待发布/已关闭以便编辑（与 admin 菜单页 getByDate 一致）
const getMenuByDate = async (req, res) => {
  const date = req.params.date; // 格式 YYYY-MM-DD
  const employeeView = req.user?.role === 'employee';

  try {
    let sql = 'SELECT * FROM daily_menus WHERE menu_date = ?';
    const params = [date];
    if (employeeView) {
      sql += " AND status = 'published'";
    }
    const [menus] = await pool.query(sql, params);

    if (menus.length === 0) {
      const msg = employeeView ? '该日菜单暂未发布' : '该日暂无菜单';
      return success(res, null, msg);
    }

    const menu = menus[0];
    const [dishes] = await pool.query(
      `SELECT d.id, d.name, d.description, d.price, d.image_url, d.category,
              md.stock, md.id AS menu_dish_id, md.meal_type
       FROM menu_dishes md
       JOIN dishes d ON md.dish_id = d.id
       WHERE md.menu_id = ?
       ORDER BY md.meal_type, d.category, d.id`,
      [menu.id]
    );

    let ordering = null;
    try {
      const settings = await getKitchenOrderingSettings();
      ordering = buildOrderingSummary(menu, settings);
    } catch (e) {
      console.warn('buildOrderingSummary skipped:', e.message);
    }

    return success(res, { ...menu, dishes, ordering });
  } catch (err) {
    console.error('getMenuByDate error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 获取今日菜单（使用服务器本地日历日，与下单逻辑 localDateStr 一致，避免 UTC 跨日错位）
const getTodayMenu = async (req, res) => {
  req.params.date = localDateStr();
  return getMenuByDate(req, res);
};

// 获取菜单列表（管理端用，分页）
const getMenuList = async (req, res) => {
  const { page = 1, page_size = 10, status, menu_date, creator_keyword } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);

  const where = ['1=1'];
  const params = [];
  if (status) {
    where.push('dm.status = ?');
    params.push(status);
  }
  if (menu_date) {
    where.push('DATE(dm.menu_date) = ?');
    params.push(menu_date);
  }
  if (creator_keyword) {
    const kw = `%${String(creator_keyword).trim()}%`;
    where.push('(u.nickname LIKE ? OR u.username LIKE ?)');
    params.push(kw, kw);
  }
  const whereSql = where.join(' AND ');

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM daily_menus dm
       LEFT JOIN users u ON dm.created_by = u.id
       WHERE ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT dm.*, u.nickname AS creator_name
       FROM daily_menus dm
       LEFT JOIN users u ON dm.created_by = u.id
       WHERE ${whereSql}
       ORDER BY dm.menu_date DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(page_size), offset]
    );

    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const placeholders = ids.map(() => '?').join(',');
      const [mealSummaries] = await pool.query(
        `SELECT md.menu_id,
          GROUP_CONCAT(
            CASE WHEN COALESCE(md.meal_type, 'lunch') = 'breakfast' THEN d.name END
            ORDER BY d.category, d.id SEPARATOR '、'
          ) AS breakfast_dishes,
          GROUP_CONCAT(
            CASE WHEN COALESCE(md.meal_type, 'lunch') = 'lunch' THEN d.name END
            ORDER BY d.category, d.id SEPARATOR '、'
          ) AS lunch_dishes
         FROM menu_dishes md
         JOIN dishes d ON md.dish_id = d.id
         WHERE md.menu_id IN (${placeholders})
         GROUP BY md.menu_id`,
        ids
      );
      const byMenuId = Object.fromEntries(
        mealSummaries.map((m) => [m.menu_id, m])
      );
      for (const row of rows) {
        const s = byMenuId[row.id];
        row.breakfast_dishes = s?.breakfast_dishes || '';
        row.lunch_dishes = s?.lunch_dishes || '';
      }
    }

    return success(res, { total, page: parseInt(page), page_size: parseInt(page_size), list: rows });
  } catch (err) {
    console.error('getMenuList error:', err);
    return fail(res, '服务器错误', 500);
  }
};

function normalizeDishRows(arr) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const dishId = typeof item === 'object' && item !== null ? Number(item.dish_id) : Number(item);
    if (!dishId || Number.isNaN(dishId) || seen.has(dishId)) continue;
    seen.add(dishId);
    const stock = typeof item === 'object' && item !== null && item.stock != null ? item.stock : null;
    out.push({ dish_id: dishId, stock });
  }
  return out;
}

// 创建或更新某日菜单（管理员）
const createOrUpdateMenu = async (req, res) => {
  const { menu_date, dish_ids, breakfast_dish_ids, lunch_dish_ids, status } = req.body;

  if (!menu_date) return fail(res, '请提供菜单日期');

  const hasMealPayload =
    Object.prototype.hasOwnProperty.call(req.body, 'breakfast_dish_ids') ||
    Object.prototype.hasOwnProperty.call(req.body, 'lunch_dish_ids');

  let breakfastRows = null;
  let lunchRows = null;
  if (hasMealPayload) {
    breakfastRows = normalizeDishRows(breakfast_dish_ids);
    lunchRows = normalizeDishRows(lunch_dish_ids);
  } else if (dish_ids && Array.isArray(dish_ids)) {
    breakfastRows = [];
    lunchRows = normalizeDishRows(dish_ids);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 查询是否已有该日菜单
    const [existing] = await conn.query(
      'SELECT id FROM daily_menus WHERE menu_date = ?',
      [menu_date]
    );

    let menuId;
    if (existing.length > 0) {
      menuId = existing[0].id;
      if (status) {
        await conn.query('UPDATE daily_menus SET status = ? WHERE id = ?', [status, menuId]);
      }
    } else {
      const [result] = await conn.query(
        'INSERT INTO daily_menus (menu_date, status, created_by) VALUES (?, ?, ?)',
        [menu_date, status || 'draft', req.user.id]
      );
      menuId = result.insertId;
    }

    // 更新菜品列表（先清空再插入，按餐次写入）
    if (breakfastRows !== null && lunchRows !== null) {
      if (breakfastRows.length + lunchRows.length === 0) {
        await conn.rollback();
        return fail(res, '请至少为早餐或午餐选择一道菜品');
      }
      await conn.query('DELETE FROM menu_dishes WHERE menu_id = ?', [menuId]);
      for (const row of breakfastRows) {
        await conn.query(
          'INSERT IGNORE INTO menu_dishes (menu_id, dish_id, meal_type, stock) VALUES (?, ?, ?, ?)',
          [menuId, row.dish_id, 'breakfast', row.stock]
        );
      }
      for (const row of lunchRows) {
        await conn.query(
          'INSERT IGNORE INTO menu_dishes (menu_id, dish_id, meal_type, stock) VALUES (?, ?, ?, ?)',
          [menuId, row.dish_id, 'lunch', row.stock]
        );
      }
    }

    const ordFields = [];
    const ordVals = [];
    const ordSpec = [
      'breakfast_order_start',
      'breakfast_order_end',
      'lunch_order_start',
      'lunch_order_end',
      'breakfast_ordering_override',
      'lunch_ordering_override',
    ];
    for (const col of ordSpec) {
      if (Object.prototype.hasOwnProperty.call(req.body, col)) {
        ordFields.push(`${col} = ?`);
        if (col.endsWith('_override')) {
          ordVals.push(normalizeOverride(req.body[col]));
        } else {
          ordVals.push(normalizeTimeForDb(req.body[col]));
        }
      }
    }
    if (ordFields.length) {
      await conn.query(
        `UPDATE daily_menus SET ${ordFields.join(', ')} WHERE id = ?`,
        [...ordVals, menuId]
      );
    }

    await conn.commit();
    return success(res, { menu_id: menuId }, existing.length > 0 ? '菜单更新成功' : '菜单创建成功');
  } catch (err) {
    await conn.rollback();
    console.error('createOrUpdateMenu error:', err);
    return fail(res, '服务器错误', 500);
  } finally {
    conn.release();
  }
};

// 更新菜单状态（发布/关闭）
const updateMenuStatus = async (req, res) => {
  const { status } = req.body;
  const validStatus = ['draft', 'published', 'closed'];
  if (!validStatus.includes(status)) return fail(res, '无效的状态值');

  try {
    const [existing] = await pool.query('SELECT id FROM daily_menus WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return fail(res, '菜单不存在', 404);

    await pool.query('UPDATE daily_menus SET status = ? WHERE id = ?', [status, req.params.id]);
    return success(res, null, '状态更新成功');
  } catch (err) {
    console.error('updateMenuStatus error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 删除菜单（管理员）
const deleteMenu = async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT id FROM daily_menus WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return fail(res, '菜单不存在', 404);

    // 检查是否有已下单的订单
    const [orders] = await pool.query(
      "SELECT id FROM orders WHERE menu_id = ? AND status NOT IN ('cancelled')",
      [req.params.id]
    );
    if (orders.length > 0) return fail(res, '该菜单已有订单，无法删除');

    await pool.query('DELETE FROM daily_menus WHERE id = ?', [req.params.id]);
    return success(res, null, '菜单已删除');
  } catch (err) {
    console.error('deleteMenu error:', err);
    return fail(res, '服务器错误', 500);
  }
};

module.exports = { getMenuByDate, getTodayMenu, getMenuList, createOrUpdateMenu, updateMenuStatus, deleteMenu };
