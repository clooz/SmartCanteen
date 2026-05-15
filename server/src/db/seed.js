/**
 * 演示数据种子脚本
 * 运行: node src/db/seed.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { pool } = require('./connection');
const bcrypt = require('bcryptjs');
const { CHEF_DEFAULT_CODE, SUPER_ADMIN_CODE } = require('../constants/permissions');

// ── 工具函数 ──────────────────────────────────────────────
const dayOffset = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
};

const datetimeOffset = (days, hour = 12, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

const orderNo = (suffix) =>
  `ORD${Date.now().toString().slice(-8)}${String(suffix).padStart(4, '0')}`;

/** 与 init.js seedInitialData 一致，供演示库补全公司扩展字段 */
const DEMO_COMPANY_BY_CODE = [
  {
    code: 'A',
    contact_name: '王明',
    contact_phone: '010-88880101',
    address: '北京市海淀区科技园路1号A座3层',
    remark: '演示数据：研发中心',
    credit_code: '91110108MA01DEMO0A',
    is_active: 1,
  },
  {
    code: 'B',
    contact_name: '李华',
    contact_phone: '021-66660202',
    address: '上海市浦东新区制造大道88号',
    remark: '演示数据：生产制造基地',
    credit_code: '91310115MA01DEMO0B',
    is_active: 1,
  },
  {
    code: 'C',
    contact_name: '陈静',
    contact_phone: '0755-88880303',
    address: '深圳市南山区粤海街道软件园二期',
    remark: '演示数据：华南分部',
    credit_code: '91440300MA01DEMO0C',
    is_active: 1,
  },
  {
    code: 'D',
    contact_name: '赵磊',
    contact_phone: '028-88880404',
    address: '成都市高新区天府大道中段',
    remark: '演示数据：西南运营中心',
    credit_code: '91510100MA01DEMO0D',
    is_active: 1,
  },
];

// ── 主流程 ────────────────────────────────────────────────
async function seed() {
  console.log('🌱 开始写入演示数据...\n');

  // ── 0. 公司扩展字段（与默认 A/B/C/D 对齐）────────────────
  console.log('🏢 补全公司联系人、地址等演示字段...');
  let companyDemoOk = 0;
  for (const c of DEMO_COMPANY_BY_CODE) {
    try {
      const [r] = await pool.query(
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
      if (r.affectedRows > 0) companyDemoOk += 1;
    } catch (e) {
      console.warn(`   ⚠ 更新公司 ${c.code} 扩展字段失败（是否已执行库迁移？）:`, e.message);
    }
  }
  console.log(`   ✅ 已尝试更新 ${DEMO_COMPANY_BY_CODE.length} 家公司的扩展信息（命中 ${companyDemoOk} 行）`);

  // 历史 admin-walkthrough-check 只写了 name/code，名称以「验收」开头的公司在此补占位数据
  try {
    const [r] = await pool.query(
      `UPDATE companies SET
        contact_name = '验收联系人',
        contact_phone = '13900000999',
        address = '自动化验收用地址（可删）',
        remark = '由 seed 对历史验收数据补齐',
        credit_code = '91110000MA01QA0099',
        is_active = 1
       WHERE name LIKE '验收%' AND (contact_name IS NULL OR TRIM(IFNULL(contact_name, '')) = '')`
    );
    if (r.affectedRows > 0) {
      console.log(`   ✅ 已为 ${r.affectedRows} 家「验收」相关公司补全扩展字段\n`);
    } else {
      console.log('   （无待补全的验收公司）\n');
    }
  } catch (e) {
    console.warn('   ⚠ 验收公司扩展字段回填失败:', e.message, '\n');
  }

  // ── 1. 用户 ─────────────────────────────────────────────
  console.log('👤 写入用户...');
  const pw = await bcrypt.hash('123456', 10);
  const pwAdmin = await bcrypt.hash('admin123', 10);

  const empEmail = (n) => `emp${String(n).padStart(3, '0')}@demo.local`;

  const users = [
    ['admin',    'admin',   '13900000001', '系统管理员', null],
    ['chef',     'chef@demo.local', '13900010002', '张伟',        null],
    ['chef',     'chef02@demo.local', '13900010003', '李娜',        null],
    ['employee', empEmail(1),  '13800238001', '王芳',        'A'],
    ['employee', empEmail(2),  '13800238002', '刘洋',        'A'],
    ['employee', empEmail(3),  '13800238003', '陈静',        'A'],
    ['employee', empEmail(4),  '13800238004', '赵磊',        'B'],
    ['employee', empEmail(5),  '13800238005', '孙丽',        'B'],
    ['employee', empEmail(6),  '13800238006', '周强',        'B'],
    ['employee', empEmail(7),  '13800238007', '吴敏',        'C'],
    ['employee', empEmail(8),  '13800238008', '郑勇',        'C'],
    ['employee', empEmail(9),  '13800238009', '黄霞',        'D'],
    ['employee', empEmail(10), '13800238010', '林峰',        'D'],
  ];

  const [companies] = await pool.query('SELECT id, code FROM companies');
  const codeToId = Object.fromEntries(companies.map(c => [c.code, c.id]));

  const userIds = {};
  for (const [role, username, phone, nickname, code] of users) {
    const password = username === 'admin' ? pwAdmin : pw;
    const company_id = code ? codeToId[code] : null;
    const [res] = await pool.query(
      `INSERT IGNORE INTO users (username, phone, password, nickname, role, company_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, phone, password, nickname, role, company_id]
    );
    if (res.insertId) {
      userIds[username] = res.insertId;
    } else {
      const [[u]] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
      userIds[username] = u.id;
    }
  }
  console.log(`   ✅ ${users.length} 个用户`);

  // INSERT IGNORE 不会更新已存在行的 phone；同时兼容旧版用户名（chef01、emp001）与新版邮箱登录名
  const phoneRows = [
    ['admin', '13900000001'],
    ['chef01', '13900000002'],
    ['chef02', '13900000003'],
    ...Array.from({ length: 10 }, (_, i) => {
      const n = i + 1;
      return [`emp${String(n).padStart(3, '0')}`, `138001380${String(n).padStart(2, '0')}`];
    }),
    ['chef@demo.local', '13900010002'],
    ['chef02@demo.local', '13900010003'],
    ...Array.from({ length: 10 }, (_, i) => {
      const n = i + 1;
      return [empEmail(n), `138002380${String(n).padStart(2, '0')}`];
    }),
  ];
  for (const [uname, ph] of phoneRows) {
    try {
      await pool.query('UPDATE users SET phone = ? WHERE username = ?', [ph, uname]);
    } catch (e) {
      console.warn(`   ⚠ 更新手机号失败 ${uname}:`, e.message);
    }
  }

  // 与 init.js migrateAdminRbac 补齐逻辑一致：仅跑 seed 时也要绑定 admin_role_id，否则厨师登录后 permissions 为空会进 403
  console.log('🔐 尝试绑定管理端岗位（RBAC）…');
  try {
    const [cdRow] = await pool.query('SELECT id FROM admin_roles WHERE code = ? LIMIT 1', [CHEF_DEFAULT_CODE]);
    if (cdRow.length) {
      const [up] = await pool.query(
        'UPDATE users SET admin_role_id = ? WHERE role = ? AND (admin_role_id IS NULL OR admin_role_id = 0)',
        [cdRow[0].id, 'chef']
      );
      if (up.affectedRows) console.log(`   ✅ 已为 ${up.affectedRows} 名厨师绑定「厨师」岗位`);
    } else {
      console.warn('   ⚠ 未找到预置厨师岗位（请先执行一次数据库初始化以创建 admin_roles）');
    }
    const [sdRow] = await pool.query('SELECT id FROM admin_roles WHERE code = ? LIMIT 1', [SUPER_ADMIN_CODE]);
    if (sdRow.length) {
      const [up] = await pool.query(
        'UPDATE users SET admin_role_id = ? WHERE role = ? AND admin_role_id IS NULL',
        [sdRow[0].id, 'admin']
      );
      if (up.affectedRows) console.log(`   ✅ 已为 ${up.affectedRows} 名管理员补齐「超级管理员」岗位`);
    }
  } catch (e) {
    console.warn('   ⚠ 绑定 admin_role_id 失败:', e.message);
  }

  // ── 2. 菜品 ─────────────────────────────────────────────
  console.log('🍽 写入菜品...');
  const dishes = [
    // name, price, category, description
    ['白米饭',       2.0,  '主食', '香糯白米，现蒸现售'],
    ['蛋炒饭',       8.0,  '主食', '鸡蛋与米饭完美融合，粒粒分明'],
    ['扬州炒饭',    12.0,  '主食', '虾仁、火腿、玉米，配料丰富'],
    ['葱油拌面',     7.0,  '主食', '手工细面，葱香浓郁'],
    ['牛肉拉面',    16.0,  '主食', '手工拉面配红烧牛肉，汤底醇厚'],
    ['猪肉包子',     3.0,  '主食', '薄皮大馅，现蒸现卖'],
    ['红烧肉',      18.0,  '荤菜', '五花肉慢炖，肥而不腻'],
    ['宫保鸡丁',    16.0,  '荤菜', '鸡丁嫩滑，花生酥脆，微辣下饭'],
    ['鱼香肉丝',    15.0,  '荤菜', '经典川味，酸甜微辣'],
    ['糖醋里脊',    18.0,  '荤菜', '外酥里嫩，酸甜可口'],
    ['清蒸鲈鱼',    28.0,  '荤菜', '新鲜鲈鱼清蒸，鲜嫩无腥'],
    ['回锅肉',      16.0,  '荤菜', '五花肉与青椒，经典川味'],
    ['水煮鱼',      22.0,  '荤菜', '麻辣鲜香，鱼片嫩滑'],
    ['清炒西兰花',   8.0,  '素菜', '新鲜西兰花，清淡爽口'],
    ['番茄炒蛋',    10.0,  '素菜', '家常必备，酸甜开胃'],
    ['拍黄瓜',       6.0,  '素菜', '清凉爽脆，蒜香浓郁'],
    ['炒青菜',       6.0,  '素菜', '时令青菜，清炒保留原味'],
    ['麻婆豆腐',    10.0,  '素菜', '麻辣嫩滑，下饭神器'],
    ['地三鲜',      12.0,  '素菜', '茄子土豆青椒，东北名菜'],
    ['紫菜蛋花汤',   4.0,  '汤',   '清淡鲜美，营养丰富'],
    ['番茄蛋汤',     4.0,  '汤',   '酸甜开胃，简单美味'],
    ['冬瓜排骨汤',  12.0,  '汤',   '清甜不腻，慢火熬制'],
    ['酸辣汤',       5.0,  '汤',   '酸辣鲜香，开胃暖身'],
    ['春卷',         6.0,  '小吃', '外酥内嫩，馅料丰富'],
    ['煎饺',         8.0,  '小吃', '底部金黄酥脆，内馅鲜嫩'],
    ['矿泉水',       2.0,  '饮料', '天然矿泉水，清凉解渴'],
    ['绿茶',         3.0,  '饮料', '清香绿茶，现泡现喝'],
    ['酸奶',         5.0,  '饮料', '浓稠酸奶，营养健康'],
    ['鲜榨橙汁',     8.0,  '饮料', '新鲜橙子现榨，维C满满'],
  ];

  const dishIds = [];
  for (const [name, price, category, description] of dishes) {
    const [res] = await pool.query(
      `INSERT IGNORE INTO dishes (name, price, category, description)
       VALUES (?, ?, ?, ?)`,
      [name, price, category, description]
    );
    if (res.insertId) {
      dishIds.push(res.insertId);
    } else {
      const [[d]] = await pool.query('SELECT id FROM dishes WHERE name = ?', [name]);
      dishIds.push(d.id);
    }
  }
  console.log(`   ✅ ${dishes.length} 道菜品`);

  // ── 3. 每日菜单（近 7 天 + 明天）────────────────────────
  console.log('📅 写入菜单...');
  const adminId = userIds['admin'];

  // 每个菜单配置：日期偏移, 状态, 选哪些菜品索引
  const menuConfigs = [
    { day: -6, status: 'closed',    dishIdxs: [0,1,6,7,8,13,14,18,19,25,26] },
    { day: -5, status: 'closed',    dishIdxs: [0,2,9,10,11,13,15,20,21,25,27] },
    { day: -4, status: 'closed',    dishIdxs: [0,4,7,12,14,16,17,22,24,26,28] },
    { day: -3, status: 'closed',    dishIdxs: [0,1,6,8,13,15,19,20,23,25,27] },
    { day: -2, status: 'closed',    dishIdxs: [0,3,9,11,14,16,18,21,24,26,28] },
    { day: -1, status: 'closed',    dishIdxs: [0,2,7,10,13,17,19,22,25,26,27] },
    { day:  0, status: 'published', dishIdxs: [0,1,6,7,8,13,14,15,19,20,23,25,26,27,28] },
    { day:  1, status: 'draft',     dishIdxs: [0,4,9,10,16,17,21,24,26,27,28] },
  ];

  // 固定早餐演示：与午餐区分明显（米饭、包子、例汤、春卷、酸奶）
  const BREAKFAST_DISH_IDXS = [0, 5, 18, 23, 26];

  const menuIds = {};
  for (const { day, status, dishIdxs } of menuConfigs) {
    const date = dayOffset(day);
    const [res] = await pool.query(
      `INSERT IGNORE INTO daily_menus (menu_date, status, created_by) VALUES (?, ?, ?)`,
      [date, status, adminId]
    );
    let menuId;
    if (res.insertId) {
      menuId = res.insertId;
    } else {
      const [[m]] = await pool.query('SELECT id FROM daily_menus WHERE menu_date = ?', [date]);
      menuId = m.id;
    }
    menuIds[day] = menuId;

    for (const idx of BREAKFAST_DISH_IDXS) {
      const stock = Math.random() > 0.5 ? Math.floor(Math.random() * 50) + 30 : null;
      await pool.query(
        `INSERT IGNORE INTO menu_dishes (menu_id, dish_id, meal_type, stock) VALUES (?, ?, 'breakfast', ?)`,
        [menuId, dishIds[idx], stock]
      );
    }
    for (const idx of dishIdxs) {
      const stock = Math.random() > 0.5 ? Math.floor(Math.random() * 50) + 30 : null;
      await pool.query(
        `INSERT IGNORE INTO menu_dishes (menu_id, dish_id, meal_type, stock) VALUES (?, ?, 'lunch', ?)`,
        [menuId, dishIds[idx], stock]
      );
    }
  }

  // 已有库若菜单里没有任何早餐行，补齐固定早餐演示（INSERT IGNORE 防重复）
  await pool.query(`
    INSERT IGNORE INTO menu_dishes (menu_id, dish_id, meal_type, stock)
    SELECT dm.id, d.id, 'breakfast', NULL
    FROM daily_menus dm
    JOIN dishes d ON d.name IN ('白米饭','猪肉包子','紫菜蛋花汤','春卷','酸奶')
    WHERE NOT EXISTS (
      SELECT 1 FROM menu_dishes x WHERE x.menu_id = dm.id AND x.meal_type = 'breakfast'
    )
  `);
  console.log(`   ✅ ${menuConfigs.length} 个菜单`);

  // ── 4. 订单 ─────────────────────────────────────────────
  console.log('📦 写入订单...');
  const employees = Array.from({ length: 10 }, (_, i) => empEmail(i + 1));

  // 过去 6 天：已完成订单
  let orderCount = 0;
  for (let day = -6; day <= -1; day++) {
    const menuId = menuIds[day];
    const { dishIdxs } = menuConfigs.find(m => m.day === day);
    const ordersPerDay = 6 + Math.floor(Math.random() * 5); // 6~10 单/天

    for (let i = 0; i < ordersPerDay; i++) {
      const user = employees[Math.floor(Math.random() * employees.length)];
      const uid = userIds[user];
      const hour = 11 + Math.floor(Math.random() * 2); // 11~12点
      const min = Math.floor(Math.random() * 60);
      const createdAt = datetimeOffset(day, hour, min);

      // 随机 1~3 道菜
      const picked = dishIdxs
        .sort(() => Math.random() - 0.5)
        .slice(0, 1 + Math.floor(Math.random() * 3));

      let total = 0;
      const items = picked.map(idx => {
        const qty = 1 + Math.floor(Math.random() * 2);
        const sub = dishes[idx][1] * qty;
        total += sub;
        return { name: dishes[idx][0], price: dishes[idx][1], dishId: dishIds[idx], qty, sub };
      });

      const no = orderNo(orderCount++);
      const remark = Math.random() > 0.8 ? ['不要辣', '少盐', '多放葱', '打包'][Math.floor(Math.random() * 4)] : '';
      const [oRes] = await pool.query(
        `INSERT INTO orders (order_no, user_id, menu_id, meal_type, total_amount, status, remark, created_at, updated_at)
         VALUES (?, ?, ?, 'lunch', ?, 'done', ?, ?, ?)`,
        [no, uid, menuId, total.toFixed(2), remark, createdAt, createdAt]
      );
      const oid = oRes.insertId;
      for (const it of items) {
        await pool.query(
          `INSERT INTO order_items (order_id, dish_id, dish_name, dish_price, quantity, subtotal)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [oid, it.dishId, it.name, it.price, it.qty, it.sub.toFixed(2)]
        );
      }
    }
  }

  // 今天：几个进行中的订单（pending / confirmed / ready）
  const todayMenuId = menuIds[0];
  const todayDishIdxs = menuConfigs.find(m => m.day === 0).dishIdxs;
  const liveStatuses = ['pending', 'pending', 'confirmed', 'confirmed', 'ready'];
  for (let i = 0; i < 5; i++) {
    const user = employees[i];
    const uid = userIds[user];
    const picked = todayDishIdxs
      .sort(() => Math.random() - 0.5)
      .slice(0, 1 + Math.floor(Math.random() * 3));
    let total = 0;
    const items = picked.map(idx => {
      const qty = 1;
      const sub = dishes[idx][1] * qty;
      total += sub;
      return { name: dishes[idx][0], price: dishes[idx][1], dishId: dishIds[idx], qty, sub };
    });
    const no = orderNo(orderCount++);
    const status = liveStatuses[i];
    const [oRes] = await pool.query(
      `INSERT INTO orders (order_no, user_id, menu_id, meal_type, total_amount, status, remark)
       VALUES (?, ?, ?, 'lunch', ?, ?, '')`,
      [no, uid, todayMenuId, total.toFixed(2), status]
    );
    const oid = oRes.insertId;
    for (const it of items) {
      await pool.query(
        `INSERT INTO order_items (order_id, dish_id, dish_name, dish_price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [oid, it.dishId, it.name, it.price, it.qty, it.sub.toFixed(2)]
      );
    }
  }
  console.log(`   ✅ ${orderCount} 条订单`);

  // ── 5. 许愿活动 ──────────────────────────────────────────
  console.log('⭐ 写入许愿活动...');
  const [actRes] = await pool.query(
    `INSERT IGNORE INTO wish_activities (title, description, start_at, end_at, status, created_by)
     VALUES (?, ?, ?, ?, 'active', ?)`,
    [
      '五月美食许愿活动',
      '快来告诉我们你最想吃什么！点赞数最高的菜品将在下周菜单中出现。',
      datetimeOffset(-7, 9, 0),
      datetimeOffset(7, 23, 59),
      adminId,
    ]
  );
  const [actRes2] = await pool.query(
    `INSERT IGNORE INTO wish_activities (title, description, start_at, end_at, status, created_by)
     VALUES (?, ?, ?, ?, 'closed', ?)`,
    [
      '四月菜品征集',
      '本次活动已结束，感谢大家的参与！',
      datetimeOffset(-30, 9, 0),
      datetimeOffset(-16, 23, 59),
      adminId,
    ]
  );

  let actId, actId2;
  if (actRes.insertId) {
    actId = actRes.insertId;
  } else {
    const [[a]] = await pool.query("SELECT id FROM wish_activities WHERE title = '五月美食许愿活动'");
    actId = a.id;
  }
  if (actRes2.insertId) {
    actId2 = actRes2.insertId;
  } else {
    const [[a]] = await pool.query("SELECT id FROM wish_activities WHERE title = '四月菜品征集'");
    actId2 = a.id;
  }

  // 许愿条目
  const wishItems = [
    { user: empEmail(1), dish: '麻辣小龙虾', desc: '夏天了，想吃小龙虾！', votes: 8 },
    { user: empEmail(2), dish: '烤鸭饭',      desc: '北京烤鸭配米饭，超级期待',  votes: 12 },
    { user: empEmail(3), dish: '酸菜鱼',      desc: '酸菜鱼汤鲜味美，强烈推荐',  votes: 6 },
    { user: empEmail(4), dish: '剁椒鱼头',    desc: '湘菜经典，非常下饭',        votes: 5 },
    { user: empEmail(5), dish: '佛跳墙',      desc: '高端食材，犒劳一下自己',    votes: 3 },
    { user: empEmail(6), dish: '椰汁西米露',  desc: '饭后甜品，清凉解腻',       votes: 10 },
  ];
  for (const wi of wishItems) {
    const [wiRes] = await pool.query(
      `INSERT IGNORE INTO wish_items (activity_id, user_id, dish_name, description, vote_count)
       VALUES (?, ?, ?, ?, ?)`,
      [actId, userIds[wi.user], wi.dish, wi.desc, wi.votes]
    );
    if (wiRes.insertId) {
      // 模拟投票记录
      const voters = employees.sort(() => Math.random() - 0.5).slice(0, wi.votes);
      for (const voter of voters) {
        await pool.query(
          `INSERT IGNORE INTO wish_votes (wish_item_id, user_id) VALUES (?, ?)`,
          [wiRes.insertId, userIds[voter]]
        ).catch(() => {});
      }
    }
  }

  // 已结束活动的许愿条目（已采纳1条）
  const [oldWish] = await pool.query(
    `INSERT IGNORE INTO wish_items (activity_id, user_id, dish_name, description, vote_count, is_adopted)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [actId2, userIds[empEmail(1)], '番茄炒蛋', '经典家常菜，百吃不厌', 20]
  );
  await pool.query(
    `INSERT IGNORE INTO wish_items (activity_id, user_id, dish_name, description, vote_count)
     VALUES (?, ?, ?, ?, ?)`,
    [actId2, userIds[empEmail(3)], '糖醋鲤鱼', '酸甜开胃，节日首选', 8]
  );
  console.log('   ✅ 2 个许愿活动，6 条愿望');

  // ── 6. 充值申请 ──────────────────────────────────────────
  console.log('💳 写入充值记录...');
  const recharges = [
    { user: empEmail(1), amount: 200, status: 'completed', remark: '本月餐费充值', review_note: '已到账', reviewer: 'admin' },
    { user: empEmail(2), amount: 100, status: 'completed', remark: '',             review_note: '已到账', reviewer: 'admin' },
    { user: empEmail(3), amount: 300, status: 'pending',   remark: '三个月餐费',   review_note: '',       reviewer: null },
    { user: empEmail(4), amount: 150, status: 'pending',   remark: '微信转账',     review_note: '',       reviewer: null },
    { user: empEmail(5), amount: 50,  status: 'rejected',  remark: '补充上月余额', review_note: '凭证模糊，请重新上传', reviewer: 'admin' },
    { user: empEmail(7), amount: 200, status: 'completed', remark: '',             review_note: '已到账', reviewer: 'admin' },
    { user: empEmail(9), amount: 100, status: 'pending',   remark: '支付宝转账',   review_note: '',       reviewer: null },
  ];
  for (const r of recharges) {
    const reviewedBy = r.reviewer ? userIds[r.reviewer] : null;
    const reviewedAt = r.status !== 'pending' ? datetimeOffset(-1, 14, 30) : null;
    await pool.query(
      `INSERT INTO recharge_records
       (user_id, amount, status, remark, review_note, reviewed_by, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userIds[r.user], r.amount, r.status, r.remark, r.review_note, reviewedBy, reviewedAt]
    );
  }
  console.log(`   ✅ ${recharges.length} 条充值记录`);

  console.log('\n🎉 演示数据写入完成！\n');
  console.log('账号一览：');
  console.log('  管理员  admin / admin123  手机 13900000001');
  console.log('  厨师    chef01 / 123456  手机 13900000002（旧）或 chef@demo.local / 13900010002（新）');
  console.log('  员工    emp001~emp010 / 123456  手机 13800138001~10（旧）');
  console.log('  员工    emp001@demo.local~ / 123456  手机 13800238001~10（新）');
  console.log('\n推荐联调：emp001@demo.local / 13800238001；若库里仍是 emp001 则手机 13800138001；密码 123456；验证码 123456');
  await pool.end();
}

seed().catch(err => {
  console.error('❌ 写入失败:', err.message);
  process.exit(1);
});
