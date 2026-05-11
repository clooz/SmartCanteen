const { pool } = require('../db/connection');
const { success, fail } = require('../utils/response');

// 获取某日菜单（含菜品列表）
const getMenuByDate = async (req, res) => {
  const date = req.params.date; // 格式 YYYY-MM-DD

  try {
    const [menus] = await pool.query(
      'SELECT * FROM daily_menus WHERE menu_date = ?',
      [date]
    );

    if (menus.length === 0) {
      return success(res, null, '该日暂无菜单');
    }

    const menu = menus[0];
    const [dishes] = await pool.query(
      `SELECT d.id, d.name, d.description, d.price, d.image_url, d.category,
              md.stock, md.id AS menu_dish_id
       FROM menu_dishes md
       JOIN dishes d ON md.dish_id = d.id
       WHERE md.menu_id = ?
       ORDER BY d.category, d.id`,
      [menu.id]
    );

    return success(res, { ...menu, dishes });
  } catch (err) {
    console.error('getMenuByDate error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 获取今日菜单
const getTodayMenu = async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  req.params.date = today;
  return getMenuByDate(req, res);
};

// 获取菜单列表（管理端用，分页）
const getMenuList = async (req, res) => {
  const { page = 1, page_size = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);

  try {
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM daily_menus');
    const [rows] = await pool.query(
      `SELECT dm.*, u.nickname AS creator_name
       FROM daily_menus dm
       LEFT JOIN users u ON dm.created_by = u.id
       ORDER BY dm.menu_date DESC
       LIMIT ? OFFSET ?`,
      [parseInt(page_size), offset]
    );
    return success(res, { total, page: parseInt(page), page_size: parseInt(page_size), list: rows });
  } catch (err) {
    console.error('getMenuList error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 创建或更新某日菜单（管理员）
const createOrUpdateMenu = async (req, res) => {
  const { menu_date, dish_ids, status } = req.body;
  // dish_ids: [{ dish_id, stock }] 或 [dish_id, ...]

  if (!menu_date) return fail(res, '请提供菜单日期');

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

    // 更新菜品列表（先清空再插入）
    if (dish_ids && Array.isArray(dish_ids)) {
      await conn.query('DELETE FROM menu_dishes WHERE menu_id = ?', [menuId]);
      for (const item of dish_ids) {
        const dishId = typeof item === 'object' ? item.dish_id : item;
        const stock = typeof item === 'object' ? (item.stock || null) : null;
        await conn.query(
          'INSERT IGNORE INTO menu_dishes (menu_id, dish_id, stock) VALUES (?, ?, ?)',
          [menuId, dishId, stock]
        );
      }
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
