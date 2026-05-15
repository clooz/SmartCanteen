const { pool } = require('./connection');

const CREATE_TABLES = [
  // 公司表
  `CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '公司名称',
    code VARCHAR(20) NOT NULL UNIQUE COMMENT '公司编码，如 A/B/C/D',
    contact_name VARCHAR(50) DEFAULT NULL COMMENT '联系人',
    contact_phone VARCHAR(30) DEFAULT NULL COMMENT '联系电话',
    address VARCHAR(255) DEFAULT NULL COMMENT '办公地址',
    remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
    credit_code VARCHAR(32) DEFAULT NULL COMMENT '统一社会信用代码',
    is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) COMMENT='公司表'`,

  // 用户表（username 存登录名，常用邮箱；phone 可空唯一）
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(191) NOT NULL UNIQUE COMMENT '登录名（常用邮箱）',
    phone VARCHAR(20) DEFAULT NULL COMMENT '绑定手机号',
    password VARCHAR(255) NOT NULL COMMENT 'bcrypt 加密密码',
    nickname VARCHAR(50) DEFAULT '' COMMENT '昵称',
    avatar VARCHAR(255) DEFAULT '' COMMENT '头像URL',
    role ENUM('employee', 'chef', 'admin') NOT NULL DEFAULT 'employee' COMMENT '角色',
    company_id INT DEFAULT NULL COMMENT '所属公司ID，厨师/管理员可为空',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    ext_uid VARCHAR(100) DEFAULT NULL UNIQUE COMMENT '外部平台用户ID（钉钉/企微/飞书/自研HR等）',
    sync_source VARCHAR(50) DEFAULT NULL COMMENT '同步来源标识，如 dingtalk/wecom/feishu/hr',
    synced_at DATETIME DEFAULT NULL COMMENT '最近一次从外部平台同步的时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_users_phone (phone),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
  ) COMMENT='用户表'`,

  // 短信/邮箱验证码（登录、绑定、找回密码等）
  `CREATE TABLE IF NOT EXISTS sms_verifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    target VARCHAR(191) NOT NULL COMMENT '手机号或邮箱',
    channel ENUM('sms', 'email') NOT NULL DEFAULT 'sms',
    purpose VARCHAR(32) NOT NULL COMMENT 'login/bind_phone/forgot_sms/forgot_email',
    code_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_target_purpose_created (target(64), channel, purpose, created_at)
  ) COMMENT='验证码记录'`,

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
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_dish_name (name)
  ) COMMENT='菜品表'`,

  // 全厨房统一默认订餐时段（单行 id=1）
  `CREATE TABLE IF NOT EXISTS kitchen_ordering_settings (
    id INT PRIMARY KEY DEFAULT 1,
    breakfast_order_start TIME NOT NULL DEFAULT '06:30:00' COMMENT '默认早餐订餐开始',
    breakfast_order_end TIME NOT NULL DEFAULT '09:30:00' COMMENT '默认早餐订餐结束',
    lunch_order_start TIME NOT NULL DEFAULT '10:00:00' COMMENT '默认午餐订餐开始',
    lunch_order_end TIME NOT NULL DEFAULT '13:30:00' COMMENT '默认午餐订餐结束',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) COMMENT='全厨房统一默认订餐时段'`,

  // 每日菜单表
  `CREATE TABLE IF NOT EXISTS daily_menus (
    id INT AUTO_INCREMENT PRIMARY KEY,
    menu_date DATE NOT NULL UNIQUE COMMENT '菜单日期',
    status ENUM('draft', 'published', 'closed') DEFAULT 'draft' COMMENT '草稿/已发布/已关闭',
    breakfast_order_start TIME DEFAULT NULL COMMENT '按日覆盖早餐开始，NULL=用全局',
    breakfast_order_end TIME DEFAULT NULL COMMENT '按日覆盖早餐结束',
    lunch_order_start TIME DEFAULT NULL COMMENT '按日覆盖午餐开始',
    lunch_order_end TIME DEFAULT NULL COMMENT '按日覆盖午餐结束',
    breakfast_ordering_override ENUM('auto', 'open', 'closed') NOT NULL DEFAULT 'auto' COMMENT '早餐：自动/强制开/强制关',
    lunch_ordering_override ENUM('auto', 'open', 'closed') NOT NULL DEFAULT 'auto' COMMENT '午餐：自动/强制开/强制关',
    created_by INT DEFAULT NULL COMMENT '创建人ID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) COMMENT='每日菜单表'`,

  // 菜单-菜品关联表（同一道菜可分别出现在早餐、午餐）
  `CREATE TABLE IF NOT EXISTS menu_dishes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    menu_id INT NOT NULL COMMENT '菜单ID',
    dish_id INT NOT NULL COMMENT '菜品ID',
    meal_type ENUM('breakfast', 'lunch') NOT NULL DEFAULT 'lunch' COMMENT '餐次：早餐/午餐',
    stock INT DEFAULT NULL COMMENT '当日限量，NULL 表示不限',
    UNIQUE KEY uk_menu_dish_meal (menu_id, dish_id, meal_type),
    FOREIGN KEY (menu_id) REFERENCES daily_menus(id) ON DELETE CASCADE,
    FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE
  ) COMMENT='菜单-菜品关联表'`,

  // 订单表
  `CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_no VARCHAR(30) NOT NULL UNIQUE COMMENT '订单号',
    user_id INT NOT NULL COMMENT '下单用户ID',
    menu_id INT NOT NULL COMMENT '对应菜单ID',
    meal_type ENUM('breakfast', 'lunch') NOT NULL DEFAULT 'lunch' COMMENT '餐次：早餐/午餐',
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
    vote_count INT DEFAULT 0 COMMENT '投点赞数',
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

  // 许愿评论表
  `CREATE TABLE IF NOT EXISTS wish_item_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    wish_item_id INT NOT NULL COMMENT '所属愿望条目ID',
    user_id INT NOT NULL COMMENT '评论用户ID',
    content VARCHAR(200) NOT NULL COMMENT '评论内容',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wish_item_id) REFERENCES wish_items(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  ) COMMENT='许愿评论表'`,

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

async function migrateSchema() {
  const dbRows = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'menu_dishes' AND COLUMN_NAME = 'meal_type'`
  );
  const cols = dbRows[0];
  if (!cols.length) {
    console.log('🔄 迁移：menu_dishes 增加餐次 meal_type …');
    await pool.query(
      `ALTER TABLE menu_dishes ADD COLUMN meal_type ENUM('breakfast','lunch') NOT NULL DEFAULT 'lunch' COMMENT '餐次：早餐/午餐' AFTER dish_id`
    );
    try {
      await pool.query('ALTER TABLE menu_dishes DROP INDEX uk_menu_dish');
    } catch (_) { /* 新库可能无此索引 */ }
    try {
      await pool.query('ALTER TABLE menu_dishes DROP INDEX uk_menu_dish_meal');
    } catch (_) { }
    await pool.query(
      'ALTER TABLE menu_dishes ADD UNIQUE KEY uk_menu_dish_meal (menu_id, dish_id, meal_type)'
    );
  }
  const [menuDishOldIdx] = await pool.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'menu_dishes' AND INDEX_NAME = 'uk_menu_dish'`
  );
  if (menuDishOldIdx.length) {
    console.log('🔄 迁移：menu_dishes 移除旧唯一索引 uk_menu_dish …');
    await pool.query('ALTER TABLE menu_dishes DROP INDEX uk_menu_dish');
    console.log('   ✅ 已允许同一道菜同时配置为不同餐次');
  }

  const ordRows = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'meal_type'`
  );
  if (!ordRows[0].length) {
    console.log('🔄 迁移：orders 增加餐次 meal_type …');
    await pool.query(
      `ALTER TABLE orders ADD COLUMN meal_type ENUM('breakfast','lunch') NOT NULL DEFAULT 'lunch' COMMENT '餐次：早餐/午餐' AFTER menu_id`
    );
  }

  // dishes.name 唯一索引迁移
  const dishNameIdx = await pool.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dishes' AND INDEX_NAME = 'uk_dish_name'`
  );
  if (!dishNameIdx[0].length) {
    console.log('🔄 迁移：dishes 表清理重复菜品并添加 name 唯一索引 …');

    // 查询所有重复菜品（保留 id 最小的原始版本，找出需要被替换掉的重复 id）
    const [dupRows] = await pool.query(`
      SELECT d1.id AS dup_id, d2.id AS keep_id
      FROM dishes d1
      INNER JOIN dishes d2 ON d1.name = d2.name AND d1.id > d2.id
    `);

    for (const { dup_id, keep_id } of dupRows) {
      // 将 order_items 中指向重复菜品的 dish_id 改为原始菜品
      await pool.query(
        `UPDATE order_items SET dish_id = ? WHERE dish_id = ?`,
        [keep_id, dup_id]
      );
      // 将 menu_dishes 中指向重复菜品的记录改为原始菜品（如冲突则直接删除重复关联）
      await pool.query(
        `UPDATE IGNORE menu_dishes SET dish_id = ? WHERE dish_id = ?`,
        [keep_id, dup_id]
      );
      await pool.query(`DELETE FROM menu_dishes WHERE dish_id = ?`, [dup_id]);
      // 删除重复菜品
      await pool.query(`DELETE FROM dishes WHERE id = ?`, [dup_id]);
    }

    // 再添加唯一索引（若已存在则跳过）
    try {
      await pool.query('ALTER TABLE dishes ADD UNIQUE KEY uk_dish_name (name)');
    } catch (e) {
      if (e.code !== 'ER_DUP_KEYNAME') throw e;
    }
    console.log(`   ✅ ${dupRows.length} 条重复菜品已清理，唯一索引已添加`);
  }

  // 外部平台对接字段迁移
  const userSyncCols = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
       AND COLUMN_NAME IN ('ext_uid','sync_source','synced_at')`
  );
  const existingSyncCols = new Set(userSyncCols[0].map((r) => r.COLUMN_NAME));
  if (!existingSyncCols.has('ext_uid')) {
    console.log('🔄 迁移：users 增加外部平台字段 ext_uid / sync_source / synced_at …');
    await pool.query(
      `ALTER TABLE users
         ADD COLUMN ext_uid VARCHAR(100) DEFAULT NULL UNIQUE COMMENT '外部平台用户ID' AFTER is_active,
         ADD COLUMN sync_source VARCHAR(50) DEFAULT NULL COMMENT '同步来源' AFTER ext_uid,
         ADD COLUMN synced_at DATETIME DEFAULT NULL COMMENT '最近同步时间' AFTER sync_source`
    );
  }

  const userPhoneCol = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone'`
  );
  if (!userPhoneCol[0].length) {
    console.log('🔄 迁移：users 增加 phone、username 扩长 …');
    try {
      await pool.query('ALTER TABLE users MODIFY COLUMN username VARCHAR(191) NOT NULL COMMENT \'登录名（常用邮箱）\'');
    } catch (e) {
      console.warn('   ⚠ username 扩长跳过:', e.message);
    }
    await pool.query(
      `ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL COMMENT '绑定手机号' AFTER username,
       ADD UNIQUE KEY uk_users_phone (phone)`
    );
  }

  const [smsTable] = await pool.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sms_verifications'`
  );
  if (!smsTable.length) {
    console.log('🔄 迁移：创建 sms_verifications …');
    await pool.query(`
      CREATE TABLE sms_verifications (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        target VARCHAR(191) NOT NULL COMMENT '手机号或邮箱',
        channel ENUM('sms', 'email') NOT NULL DEFAULT 'sms',
        purpose VARCHAR(32) NOT NULL COMMENT 'login/bind_phone/forgot_sms/forgot_email',
        code_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_target_purpose_created (target(64), channel, purpose, created_at)
      ) COMMENT='验证码记录'
    `);
  }

  const [companyExtraCols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'contact_name'`
  );
  if (!companyExtraCols.length) {
    console.log('🔄 迁移：companies 增加联系人、地址、信用代码等字段 …');
    await pool.query(`
      ALTER TABLE companies
        ADD COLUMN contact_name VARCHAR(50) DEFAULT NULL COMMENT '联系人' AFTER code,
        ADD COLUMN contact_phone VARCHAR(30) DEFAULT NULL COMMENT '联系电话' AFTER contact_name,
        ADD COLUMN address VARCHAR(255) DEFAULT NULL COMMENT '办公地址' AFTER contact_phone,
        ADD COLUMN remark VARCHAR(500) DEFAULT NULL COMMENT '备注' AFTER address,
        ADD COLUMN credit_code VARCHAR(32) DEFAULT NULL COMMENT '统一社会信用代码' AFTER remark,
        ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用' AFTER credit_code
    `);
    console.log('   ✅ companies 扩展字段已添加');
  }
}

async function migrateOrderingWindow() {
  const [tables] = await pool.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kitchen_ordering_settings'`
  );
  if (!tables.length) {
    console.log('🔄 迁移：创建 kitchen_ordering_settings（全厨房默认订餐时段）…');
    await pool.query(`
      CREATE TABLE kitchen_ordering_settings (
        id INT PRIMARY KEY DEFAULT 1,
        breakfast_order_start TIME NOT NULL DEFAULT '06:30:00',
        breakfast_order_end TIME NOT NULL DEFAULT '09:30:00',
        lunch_order_start TIME NOT NULL DEFAULT '10:00:00',
        lunch_order_end TIME NOT NULL DEFAULT '13:30:00',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) COMMENT='全厨房统一默认订餐时段'
    `);
    await pool.query(`INSERT INTO kitchen_ordering_settings (id) VALUES (1)`);
    console.log('   ✅ kitchen_ordering_settings 已创建并初始化');
  }

  const [[{ koCount }]] = await pool.query('SELECT COUNT(*) AS koCount FROM kitchen_ordering_settings');
  if (!koCount) {
    await pool.query(`INSERT INTO kitchen_ordering_settings (id) VALUES (1)`);
    console.log('   ✅ kitchen_ordering_settings 已补充默认行（id=1）');
  }

  const [colRow] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'daily_menus' AND COLUMN_NAME = 'breakfast_order_start'`
  );
  if (!colRow.length) {
    console.log('🔄 迁移：daily_menus 增加按日订餐时段与覆盖字段 …');
    await pool.query(`
      ALTER TABLE daily_menus
        ADD COLUMN breakfast_order_start TIME DEFAULT NULL COMMENT '按日覆盖早餐开始，NULL=全局',
        ADD COLUMN breakfast_order_end TIME DEFAULT NULL COMMENT '按日覆盖早餐结束',
        ADD COLUMN lunch_order_start TIME DEFAULT NULL COMMENT '按日覆盖午餐开始',
        ADD COLUMN lunch_order_end TIME DEFAULT NULL COMMENT '按日覆盖午餐结束',
        ADD COLUMN breakfast_ordering_override ENUM('auto','open','closed') NOT NULL DEFAULT 'auto' COMMENT '早餐：自动/强制开/强制关',
        ADD COLUMN lunch_ordering_override ENUM('auto','open','closed') NOT NULL DEFAULT 'auto' COMMENT '午餐：自动/强制开/强制关'
    `);
    console.log('   ✅ daily_menus 订餐字段已添加');
  }
}

async function migrateComments() {
  const [tables] = await pool.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wish_item_comments'`
  );
  if (!tables.length) {
    console.log('🔄 迁移：创建 wish_item_comments 评论表 …');
    await pool.query(`
      CREATE TABLE wish_item_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        wish_item_id INT NOT NULL COMMENT '所属愿望条目ID',
        user_id INT NOT NULL COMMENT '评论用户ID',
        content VARCHAR(200) NOT NULL COMMENT '评论内容',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (wish_item_id) REFERENCES wish_items(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      ) COMMENT='许愿评论表'
    `);
    console.log('   ✅ wish_item_comments 表已创建');
  }
}

async function migrateAdminRbac() {
  const {
    ALL_KEYS,
    SYSTEM_ADMIN_KEYS,
    CHEF_DEFAULT_KEYS,
    SUPER_ADMIN_CODE,
    SYSTEM_ADMIN_CODE,
    CHEF_DEFAULT_CODE,
  } = require('../constants/permissions');

  const [arTable] = await pool.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_roles'`
  );
  if (!arTable.length) {
    console.log('🔄 迁移：创建 admin_roles / admin_role_permissions / admin_audit_logs …');
    await pool.query(`
      CREATE TABLE admin_roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(64) NOT NULL UNIQUE COMMENT '岗位编码',
        name VARCHAR(100) NOT NULL COMMENT '展示名',
        description VARCHAR(500) DEFAULT '' COMMENT '说明',
        is_system TINYINT(1) NOT NULL DEFAULT 0 COMMENT '系统预置不可删',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) COMMENT='管理端后台岗位'
    `);
    await pool.query(`
      CREATE TABLE admin_role_permissions (
        role_id INT NOT NULL,
        permission_key VARCHAR(80) NOT NULL,
        PRIMARY KEY (role_id, permission_key),
        FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE
      ) COMMENT='岗位-权限点'
    `);
    await pool.query(`
      CREATE TABLE admin_audit_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        actor_id INT NOT NULL,
        action VARCHAR(64) NOT NULL,
        detail_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_actor (actor_id),
        KEY idx_created (created_at),
        FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
      ) COMMENT='管理端操作审计'
    `);
    console.log('   ✅ RBAC 表已创建');
  }

  const [uCol] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'admin_role_id'`
  );
  if (!uCol.length) {
    console.log('🔄 迁移：users 增加 admin_role_id …');
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN admin_role_id INT DEFAULT NULL COMMENT '后台岗位ID' AFTER role,
        ADD KEY idx_users_admin_role (admin_role_id),
        ADD CONSTRAINT fk_users_admin_role FOREIGN KEY (admin_role_id) REFERENCES admin_roles(id) ON DELETE SET NULL
    `);
    console.log('   ✅ admin_role_id 已添加');
  }

  const [[{ cntRoles }]] = await pool.query('SELECT COUNT(*) AS cntRoles FROM admin_roles');
  if (!cntRoles) {
    console.log('🔄 迁移：写入预置角色与权限 …');
    await pool.query(
      `INSERT INTO admin_roles (code, name, description, is_system) VALUES
       (?, '超级管理员', '全部管理端权限，含权限管理', 1),
       (?, '系统管理员', '日常运维，不含权限管理与审计', 1),
       (?, '厨师', '厨房与菜单订单等（可后续由超管调整）', 1)`,
      [SUPER_ADMIN_CODE, SYSTEM_ADMIN_CODE, CHEF_DEFAULT_CODE]
    );
    const [sRows] = await pool.query('SELECT id FROM admin_roles WHERE code = ?', [SUPER_ADMIN_CODE]);
    const [mRows] = await pool.query('SELECT id FROM admin_roles WHERE code = ?', [SYSTEM_ADMIN_CODE]);
    const [cRows] = await pool.query('SELECT id FROM admin_roles WHERE code = ?', [CHEF_DEFAULT_CODE]);
    const sid = sRows[0].id;
    const mid = mRows[0].id;
    const cid = cRows[0].id;

    const insPerm = async (roleId, keys) => {
      for (const k of keys) {
        await pool.query(
          'INSERT IGNORE INTO admin_role_permissions (role_id, permission_key) VALUES (?, ?)',
          [roleId, k]
        );
      }
    };
    await insPerm(sid, ALL_KEYS);
    await insPerm(mid, SYSTEM_ADMIN_KEYS);
    await insPerm(cid, CHEF_DEFAULT_KEYS);

    await pool.query(
      `UPDATE users u
       JOIN admin_roles ar ON ar.code = ?
       SET u.admin_role_id = ar.id
       WHERE u.role = 'admin'`,
      [SUPER_ADMIN_CODE]
    );
    await pool.query(
      `UPDATE users u
       JOIN admin_roles ar ON ar.code = ?
       SET u.admin_role_id = ar.id
       WHERE u.role = 'chef'`,
      [CHEF_DEFAULT_CODE]
    );
    console.log('   ✅ 预置岗位与用户绑定已写入');
  }

  // 无论是否首次写入岗位表：补齐「角色与后台岗位」列，否则岗位页 COUNT 与用户管理不一致
  const [cdRow] = await pool.query('SELECT id FROM admin_roles WHERE code = ? LIMIT 1', [CHEF_DEFAULT_CODE]);
  if (cdRow.length) {
    const [up] = await pool.query(
      'UPDATE users SET admin_role_id = ? WHERE role = ? AND (admin_role_id IS NULL OR admin_role_id = 0)',
      [cdRow[0].id, 'chef']
    );
    if (up.affectedRows) console.log(`   ✅ 已补齐 ${up.affectedRows} 名厨师的 admin_role_id（厨师岗）`);
  }
  const [sdRow] = await pool.query('SELECT id FROM admin_roles WHERE code = ? LIMIT 1', [SUPER_ADMIN_CODE]);
  if (sdRow.length) {
    const [up] = await pool.query(
      'UPDATE users SET admin_role_id = ? WHERE role = ? AND admin_role_id IS NULL',
      [sdRow[0].id, 'admin']
    );
    if (up.affectedRows) console.log(`   ✅ 已补齐 ${up.affectedRows} 名管理员的 admin_role_id（超级管理员岗）`);
  }

  // 历史种子曾用「厨师默认」等展示名，统一为「厨师」（仅当仍为旧名时更新，避免覆盖运营自定义）
  const [chefNameUp] = await pool.query(
    `UPDATE admin_roles SET name = '厨师' WHERE code = ? AND name IN ('厨师默认', '厨师岗', '厨师（默认）')`,
    [CHEF_DEFAULT_CODE]
  );
  if (chefNameUp.affectedRows) {
    console.log(`   ✅ 已将 chef_default 岗位展示名更新为「厨师」（${chefNameUp.affectedRows} 行）`);
  }
}

async function initDatabase() {
  console.log('📦 开始初始化数据库表...');
  for (const sql of CREATE_TABLES) {
    await pool.query(sql);
  }
  await migrateSchema();
  await migrateComments();
  await migrateOrderingWindow();
  await migrateAdminRbac();
  console.log('✅ 数据库表初始化完成');
  await seedInitialData();
}

// 初始化基础数据（公司 + 默认管理员）
async function seedInitialData() {
  const defaultCompanies = [
    {
      name: 'A公司',
      code: 'A',
      contact_name: '王明',
      contact_phone: '010-88880101',
      address: '北京市海淀区科技园路1号A座3层',
      remark: '演示数据：研发中心',
      credit_code: '91110108MA01DEMO0A',
      is_active: 1,
    },
    {
      name: 'B公司',
      code: 'B',
      contact_name: '李华',
      contact_phone: '021-66660202',
      address: '上海市浦东新区制造大道88号',
      remark: '演示数据：生产制造基地',
      credit_code: '91310115MA01DEMO0B',
      is_active: 1,
    },
    {
      name: 'C公司',
      code: 'C',
      contact_name: '陈静',
      contact_phone: '0755-88880303',
      address: '深圳市南山区粤海街道软件园二期',
      remark: '演示数据：华南分部',
      credit_code: '91440300MA01DEMO0C',
      is_active: 1,
    },
    {
      name: 'D公司',
      code: 'D',
      contact_name: '赵磊',
      contact_phone: '028-88880404',
      address: '成都市高新区天府大道中段',
      remark: '演示数据：西南运营中心',
      credit_code: '91510100MA01DEMO0D',
      is_active: 1,
    },
  ];
  for (const c of defaultCompanies) {
    await pool.query(
      `INSERT IGNORE INTO companies (name, code, contact_name, contact_phone, address, remark, credit_code, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        c.name,
        c.code,
        c.contact_name,
        c.contact_phone,
        c.address,
        c.remark,
        c.credit_code,
        c.is_active,
      ]
    );
    await pool.query(
      `UPDATE companies SET contact_name = ?, contact_phone = ?, address = ?, remark = ?, credit_code = ?, is_active = ?
       WHERE code = ?`,
      [
        c.contact_name,
        c.contact_phone,
        c.address,
        c.remark,
        c.credit_code,
        c.is_active,
        c.code,
      ]
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
      `INSERT INTO users (username, password, nickname, role, admin_role_id)
       SELECT 'admin', ?, '系统管理员', 'admin', id FROM admin_roles WHERE code = 'super_admin' LIMIT 1`,
      [hashed]
    );
    console.log('✅ 默认管理员账号已创建 - 用户名: admin  密码: admin123');
  } else {
    await pool.query(
      `UPDATE users u
       JOIN admin_roles ar ON ar.code = 'super_admin'
       SET u.admin_role_id = ar.id
       WHERE u.username = 'admin' AND u.role = 'admin' AND u.admin_role_id IS NULL`
    );
  }
}

module.exports = { initDatabase };
