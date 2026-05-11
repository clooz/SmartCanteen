const { pool } = require('../db/connection');
const { success, fail } = require('../utils/response');

// 获取菜品列表（支持分类筛选、关键字搜索、分页）
const getDishes = async (req, res) => {
  const { category, keyword, is_available, page = 1, page_size = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);

  let where = ['1=1'];
  let params = [];

  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  if (keyword) {
    where.push('name LIKE ?');
    params.push(`%${keyword}%`);
  }
  if (is_available !== undefined) {
    where.push('is_available = ?');
    params.push(parseInt(is_available));
  }

  const whereSql = where.join(' AND ');

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM dishes WHERE ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT * FROM dishes WHERE ${whereSql} ORDER BY category, id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(page_size), offset]
    );
    return success(res, { total, page: parseInt(page), page_size: parseInt(page_size), list: rows });
  } catch (err) {
    console.error('getDishes error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 获取单个菜品详情
const getDishById = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM dishes WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return fail(res, '菜品不存在', 404);
    return success(res, rows[0]);
  } catch (err) {
    console.error('getDishById error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 创建菜品（管理员）
const createDish = async (req, res) => {
  const { name, description, price, category } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : '';

  if (!name || !price) return fail(res, '菜品名称和价格不能为空');
  if (isNaN(price) || parseFloat(price) <= 0) return fail(res, '价格必须大于0');

  try {
    const [result] = await pool.query(
      'INSERT INTO dishes (name, description, price, image_url, category) VALUES (?, ?, ?, ?, ?)',
      [name, description || '', parseFloat(price), image_url, category || '其他']
    );
    return success(res, { id: result.insertId }, '菜品创建成功', 201);
  } catch (err) {
    console.error('createDish error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 更新菜品（管理员）
const updateDish = async (req, res) => {
  const { name, description, price, category, is_available } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : undefined;

  try {
    const [existing] = await pool.query('SELECT id FROM dishes WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return fail(res, '菜品不存在', 404);

    const fields = [];
    const params = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (description !== undefined) { fields.push('description = ?'); params.push(description); }
    if (price !== undefined) { fields.push('price = ?'); params.push(parseFloat(price)); }
    if (category !== undefined) { fields.push('category = ?'); params.push(category); }
    if (is_available !== undefined) { fields.push('is_available = ?'); params.push(parseInt(is_available)); }
    if (image_url !== undefined) { fields.push('image_url = ?'); params.push(image_url); }

    if (fields.length === 0) return fail(res, '没有需要更新的字段');

    params.push(req.params.id);
    await pool.query(`UPDATE dishes SET ${fields.join(', ')} WHERE id = ?`, params);
    return success(res, null, '更新成功');
  } catch (err) {
    console.error('updateDish error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 删除菜品（管理员，软删除：下架处理）
const deleteDish = async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT id FROM dishes WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return fail(res, '菜品不存在', 404);

    await pool.query('UPDATE dishes SET is_available = 0 WHERE id = ?', [req.params.id]);
    return success(res, null, '菜品已下架');
  } catch (err) {
    console.error('deleteDish error:', err);
    return fail(res, '服务器错误', 500);
  }
};

// 获取所有分类
const getCategories = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT DISTINCT category FROM dishes WHERE is_available = 1 ORDER BY category'
    );
    return success(res, rows.map(r => r.category));
  } catch (err) {
    console.error('getCategories error:', err);
    return fail(res, '服务器错误', 500);
  }
};

module.exports = { getDishes, getDishById, createDish, updateDish, deleteDish, getCategories };
