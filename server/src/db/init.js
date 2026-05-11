const { pool } = require('./connection');

const CREATE_TABLES = [
  // 公司表
  `CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '公司名称',
    code VARCHAR(20) NOT NULL UNIQUE COMMENT '公司编码，如 A/B/C/D',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) COMMENT='公司表'`,

  // 用户表
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名/手机号',
    password VARCHAR(255) NOT NULL COMMENT 'bcrypt 加密密码',
    nickname VARCHAR(50) DEFAULT '' COMMENT '昵称',
    avatar VARCHAR(255) DEFAULT '' COMMENT '头像URL',
    role ENUM('employee', 'chef', 'admin') NOT NULL DEFAULT 'employee' COMMENT '角色',
    company_id INT DEFAULT NULL COMMENT '所属公司ID，厨师/管理员可为空',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
  ) COMMENT='用户表'`,

  // 菜品表
  `CREATE TABLE IF NOT EXISTS dishes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '菜品名称',
    description TEXT DEFAULT NULL COMMENT '菜品描述',
    price DECIMAL(8, 2) NOT NULL COMMENT '价格',
    image_url VARCHAR(255) DEFAULT '' COMMENT '菜品图片URL',
    category VARCHAR(50) DEFAULT '其他' COMMENT '分类，如主食/荤菜/素菜/汤/饮料',
    is_available TINYINT(1) DEFAULT 1 COMMENT '是否上架',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) COMMENT='菜品表'`,

  // 每日菜单表
  `CREATE TABLE IF NOT EXISTS daily_menus (
    id INT AUTO_INCREMENT PRIMARY KEY,
    menu_date DATE NOT NULL UNIQUE COMMENT '菜单日期',
    status ENUM('draft', 'published', 'closed') DEFAULT 'draft' COMMENT '草稿/已发布/已关闭',
    created_by INT DEFAULT NULL COMMENT '创建人ID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) COMMENT='每日菜单表'`,

  // 菜单-菜品关联表
  `CREATE TABLE IF NOT EXISTS menu_dishes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    menu_id INT NOT NULL COMMENT '菜单ID',
    dish_id INT NOT NULL COMMENT '菜品ID',
    stock INT DEFAULT NULL COMMENT '当日限量，NULL 表示不限',
    UNIQUE KEY uk_menu_dish (menu_id, dish_id),
    FOREIGN KEY (menu_id) REFERENCES daily_menus(id) ON DELETE CASCADE,
    FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE
  ) COMMENT='菜单-菜品关联表'`,

  // 订单表
  `CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_no VARCHAR(30) NOT NULL UNIQUE COMMENT '订单号',
    user_id INT NOT NULL COMMENT '下单用户ID',
    menu_id INT NOT NULL COMMENT '对应菜单ID',
    total_amount DECIMAL(10, 2) NOT NULL COMMENT '订单总金额',
    status ENUM('pending', 'confirmed', 'ready', 'done', 'cancelled') DEFAULT 'pending' COMMENT '待接单/已接单/可取餐/已完成/已取消',
    remark VARCHAR(255) DEFAULT '' COMMENT '备注',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (menu_id) REFERENCES daily_menus(id)
  ) COMMENT='订单表'`,

  // 订单明细表
  `CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL COMMENT '订单ID',
    dish_id INT NOT NULL COMMENT '菜品ID',
    dish_name VARCHAR(100) NOT NULL COMMENT '菜品名称快照',
    dish_price DECIMAL(8, 2) NOT NULL COMMENT '下单时单价快照',
    quantity INT NOT NULL DEFAULT 1 COMMENT '数量',
    subtotal DECIMAL(10, 2) NOT NULL COMMENT '小计',
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (dish_id) REFERENCES dishes(id)
  ) COMMENT='订单明细表'`,

  // 许愿活动表
  `CREATE TABLE IF NOT EXISTS wish_activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL COMMENT '活动标题',
    description TEXT DEFAULT NULL COMMENT '活动描述',
    start_at DATETIME NOT NULL COMMENT '开始时间',
    end_at DATETIME NOT NULL COMMENT '截止时间',
    status ENUM('active', 'closed') DEFAULT 'active' COMMENT '进行中/已结束',
    created_by INT DEFAULT NULL COMMENT '发起人ID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) COMMENT='许愿活动表'`,

  // 许愿条目表
  `CREATE TABLE IF NOT EXISTS wish_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_id INT NOT NULL COMMENT '所属活动ID',
    user_id INT NOT NULL COMMENT '提交用户ID',
    dish_name VARCHAR(100) NOT NULL COMMENT '期望菜品名称',
    description VARCHAR(255) DEFAULT '' COMMENT '补充描述',
    vote_count INT DEFAULT 0 COMMENT '投票数',
    is_adopted TINYINT(1) DEFAULT 0 COMMENT '是否已被采纳',
    adopted_dish_id INT DEFAULT NULL COMMENT '采纳后关联的菜品ID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (activity_id) REFERENCES wish_activities(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (adopted_dish_id) REFERENCES dishes(id) ON DELETE SET NULL
  ) COMMENT='许愿条目表'`,

  // 投票记录表（防重复投票）
  `CREATE TABLE IF NOT EXISTS wish_votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    wish_item_id INT NOT NULL COMMENT '许愿条目ID',
    user_id INT NOT NULL COMMENT '投票用户ID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_vote (wish_item_id, user_id) COMMENT '每人每条愿望只能投一次',
    FOREIGN KEY (wish_item_id) REFERENCES wish_items(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  ) COMMENT='许愿投票记录表'`,

  // 饭卡充值申请表
  `CREATE TABLE IF NOT EXISTS recharge_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '申请用户ID',
    amount DECIMAL(10, 2) NOT NULL COMMENT '申请充值金额',
    proof_image_url VARCHAR(255) DEFAULT '' COMMENT '转账凭证图片URL',
    status ENUM('pending', 'completed', 'rejected') DEFAULT 'pending' COMMENT '待处理/已完成/已驳回',
    remark VARCHAR(255) DEFAULT '' COMMENT '用户备注',
    review_note VARCHAR(255) DEFAULT '' COMMENT '管理员审核备注',
    reviewed_by INT DEFAULT NULL COMMENT '处理人ID',
    reviewed_at DATETIME DEFAULT NULL COMMENT '处理时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
  ) COMMENT='饭卡充值申请表'`,
];

async function initDatabase() {
  console.log('📦 开始初始化数据库表...');
  for (const sql of CREATE_TABLES) {
    await pool.query(sql);
  }
  console.log('✅ 数据库表初始化完成');
  await seedInitialData();
}

// 初始化基础数据（公司 + 默认管理员）
async function seedInitialData() {
  // 写入默认公司（如已存在则跳过）
  const defaultCompanies = [
    { name: 'A公司', code: 'A' },
    { name: 'B公司', code: 'B' },
    { name: 'C公司', code: 'C' },
    { name: 'D公司', code: 'D' },
  ];
  for (const c of defaultCompanies) {
    await pool.query(
      'INSERT IGNORE INTO companies (name, code) VALUES (?, ?)',
      [c.name, c.code]
    );
  }

  // 写入默认管理员账号（如已存在则跳过）
  const bcrypt = require('bcryptjs');
  const [existing] = await pool.query(
    "SELECT id FROM users WHERE username = 'admin'"
  );
  if (existing.length === 0) {
    const hashed = await bcrypt.hash('admin123', 10);
    await pool.query(
      "INSERT INTO users (username, password, nickname, role) VALUES ('admin', ?, '系统管理员', 'admin')",
      [hashed]
    );
    console.log('✅ 默认管理员账号已创建 - 用户名: admin  密码: admin123');
  }
}

module.exports = { initDatabase };
