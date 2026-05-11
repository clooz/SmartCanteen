const { pool } = require('../db/connection');
const { success, fail } = require('../utils/response');

// 生成订单号：日期 + 6位随机数
function generateOrderNo() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `SC${date}${rand}`;
}

// 用户提交订单
const createOrder = async (req, res) => {
  const { items, remark } = req.body;
  // items: [{ dish_id, quantity }]

  if (!items || !Array.isArray(items) || items.length === 0) {
    return fail(res, '订单不能为空');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 查询今日已发布的菜单
    const today = new Date().toISOString().slice(0, 10);
    const [menus] = await conn.query(
      "SELECT id FROM daily_menus WHERE menu_date = ? AND status = 'published'",
      [today]
    );
    if (menus.length === 0) {
      await conn.rollback();
      return fail(res, '今日菜单尚未发布，暂时无法下单');
    }
    const menuId = menus[0].id;

    // 验证所有菜品是否在今日菜单中，并获取价格
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      if (!item.dish_id || !item.quantity || item.quantity < 1) {
        await conn.rollback();
        return fail(res, '订单数据格式不正确');
      }

      const [dishRows] = await conn.query(
        `SELECT d.id, d.name, d.price, md.stock
         FROM menu_dishes md
         JOIN dishes d ON md.dish_id = d.id
         WHERE md.menu_id = ? AND d.id = ? AND d.is_available = 1`,
        [menuId, item.dish_id]
      );

      if (dishRows.length === 0) {
        await conn.rollback();
        return fail(res, `菜品 ID ${item.dish_id} 不在今日菜单中`);
      }

      const dish = dishRows[0];

      // 检查库存
      if (dish.stock !== null && dish.stock < item.quantity) {
        await conn.rollback();
        return fail(res, `菜品「${dish.name}」库存不足`);
      }

      const subtotal = parseFloat(dish.price) * parseInt(item.quantity);
      totalAmount += subtotal;
      orderItems.push({
        dish_id: dish.id,
        dish_name: dish.name,
        dish_price: dish.price,
        quantity: item.quantity,
        subtotal,
      });
    }

    // 创建订单
    const orderNo = generateOrderNo();
    const [orderResult] = await conn.query(
      'INSERT INTO orders (order_no, user_id, menu_id, total_amount, remark) VALUES (?, ?, ?, ?, ?)',
      [orderNo, req.user.id, menuId, totalAmount.toFixed(2), remark || '']
    );
    const orderId = orderResult.insertId;

    // 插入订单明细
    for (const item of orderItems) {
      await conn.query(
        'INSERT INTO order_items (order_id, dish_id, dish_name, dish_price, quantity, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
        [orderId, item.dish_id, item.dish_name, item.dish_price, item.quantity, item.subtotal]
      );

      // 扣减库存
      await conn.query(
        'UPDATE menu_dishes SET stock = stock - ? WHERE menu_id = ? AND dish_id = ? AND stock IS NOT NULL',
        [item.quantity, menuId, item.dish_id]
      );
    }

    await conn.commit();

    // 通知厨房端（Socket.io）
    const io = req.app.get('io');
    if (io) {
      const [newOrder] = await pool.query(
        `SELECT o.*, u.nickname AS user_name, c.name AS company_name
         FROM orders o
         JOIN users u ON o.user_id = u.id
         LEFT JOIN companies c ON u.company_id = c.id
         WHERE o.id = ?`,
        [orderId]
      );
      io.to('kitchen').emit('new_order', { ...newOrder[0], items: orderItems });
    }

    return success(res, { order_id: orderId, order_no: orderNo, total_amount: totalAmount.toFixed(2) }, '下单成功', 201);
  } catch (err) {
    await conn.rollback();
    console.error('createOrder error:', err);
    return fail(res, '服务器错误', 500);
  } finally {
    conn.release();
  }
};

// 获取订单详情
const getOrderById = async (req, res) => {
  try {
    const [orders] = await pool.query(
      `SELECT o.*, u.nickname AS user_name, c.name AS company_name
       FROM orders o
       JOIN users u ON o.user_id = u.id
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE o.id = ?`,
      [req.params.id]
    );
    if (orders.length === 0) return fail(res, '订单不存在', 404);

    const order = orders[0];

    // 非管理员/厨师只能查看自己的订单
    if (req.user.role === 'employee' && order.user_id !== req.user.id) {
      return fail(res, '无权查看该订单', 403);
    }

    const [items] = await pool.query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [order.id]
    );

    return success(res, { ...order, items });
  } catch (err) {
    console.error('getOrderById error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 用户查看自己的订单列表
const getMyOrders = async (req, res) => {
  const { page = 1, page_size = 10, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);

  let where = ['o.user_id = ?'];
  let params = [req.user.id];
  if (status) { where.push('o.status = ?'); params.push(status); }

  const whereSql = where.join(' AND ');

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM orders o WHERE ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT o.*, u.nickname AS user_name, c.name AS company_name
       FROM orders o
       JOIN users u ON o.user_id = u.id
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE ${whereSql}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(page_size), offset]
    );

    // 附带订单明细
    for (const order of rows) {
      const [items] = await pool.query(
        'SELECT * FROM order_items WHERE order_id = ?',
        [order.id]
      );
      order.items = items;
    }

    return success(res, { total, page: parseInt(page), page_size: parseInt(page_size), list: rows });
  } catch (err) {
    console.error('getMyOrders error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 厨师/管理员查看所有订单
const getAllOrders = async (req, res) => {
  const { page = 1, page_size = 20, status, date, company_id } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);

  let where = ['1=1'];
  let params = [];

  if (status) { where.push('o.status = ?'); params.push(status); }
  if (date) { where.push('DATE(o.created_at) = ?'); params.push(date); }
  if (company_id) { where.push('u.company_id = ?'); params.push(company_id); }

  const whereSql = where.join(' AND ');

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM orders o JOIN users u ON o.user_id = u.id WHERE ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT o.*, u.nickname AS user_name, c.name AS company_name, c.code AS company_code
       FROM orders o
       JOIN users u ON o.user_id = u.id
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE ${whereSql}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(page_size), offset]
    );

    for (const order of rows) {
      const [items] = await pool.query(
        'SELECT * FROM order_items WHERE order_id = ?',
        [order.id]
      );
      order.items = items;
    }

    return success(res, { total, page: parseInt(page), page_size: parseInt(page_size), list: rows });
  } catch (err) {
    console.error('getAllOrders error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 更新订单状态（厨师操作：confirmed / ready / done；用户可取消 pending 状态订单）
const updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const orderId = req.params.id;

  try {
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (orders.length === 0) return fail(res, '订单不存在', 404);

    const order = orders[0];

    // 员工只能取消自己的 pending 订单
    if (req.user.role === 'employee') {
      if (order.user_id !== req.user.id) return fail(res, '无权操作', 403);
      if (status !== 'cancelled') return fail(res, '员工只能取消订单', 403);
      if (order.status !== 'pending') return fail(res, '只有待接单的订单才能取消');
    }

    // 厨师/管理员可以更新所有状态
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['ready', 'cancelled'],
      ready: ['done'],
      done: [],
      cancelled: [],
    };

    if (!validTransitions[order.status].includes(status)) {
      return fail(res, `订单状态不能从 ${order.status} 变更为 ${status}`);
    }

    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);

    // 通知厨房端状态变更
    const io = req.app.get('io');
    if (io) {
      io.to('kitchen').emit('order_status_changed', { order_id: orderId, status });
    }

    return success(res, null, '状态更新成功');
  } catch (err) {
    console.error('updateOrderStatus error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 消费统计报表（管理员）
const getReport = async (req, res) => {
  const { start_date, end_date, company_id } = req.query;

  if (!start_date || !end_date) return fail(res, '请提供起止日期');

  let companyWhere = '';
  let params = [start_date, end_date];
  if (company_id) {
    companyWhere = 'AND u.company_id = ?';
    params.push(company_id);
  }

  try {
    // 按公司汇总
    const [byCompany] = await pool.query(
      `SELECT c.name AS company_name, c.code AS company_code,
              COUNT(DISTINCT o.id) AS order_count,
              SUM(o.total_amount) AS total_amount
       FROM orders o
       JOIN users u ON o.user_id = u.id
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE DATE(o.created_at) BETWEEN ? AND ?
         AND o.status != 'cancelled'
         ${companyWhere}
       GROUP BY u.company_id
       ORDER BY total_amount DESC`,
      params
    );

    // 按日期汇总
    const [byDate] = await pool.query(
      `SELECT DATE(o.created_at) AS date,
              COUNT(DISTINCT o.id) AS order_count,
              SUM(o.total_amount) AS total_amount
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE DATE(o.created_at) BETWEEN ? AND ?
         AND o.status != 'cancelled'
         ${companyWhere}
       GROUP BY DATE(o.created_at)
       ORDER BY date`,
      params
    );

    // 热销菜品 TOP10
    const [topDishes] = await pool.query(
      `SELECT oi.dish_name, SUM(oi.quantity) AS total_qty, SUM(oi.subtotal) AS total_amount
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN users u ON o.user_id = u.id
       WHERE DATE(o.created_at) BETWEEN ? AND ?
         AND o.status != 'cancelled'
         ${companyWhere}
       GROUP BY oi.dish_name
       ORDER BY total_qty DESC
       LIMIT 10`,
      params
    );

    return success(res, { by_company: byCompany, by_date: byDate, top_dishes: topDishes });
  } catch (err) {
    console.error('getReport error:', err);
    return fail(res, '服务器错误', 500);
  }
};

module.exports = { createOrder, getOrderById, getMyOrders, getAllOrders, updateOrderStatus, getReport };
