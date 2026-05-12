/**
 * 演示数据种子脚本
 * 运行: node src/db/seed.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { pool } = require('./connection');
const bcrypt = require('bcryptjs');

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

// ── 主流程 ────────────────────────────────────────────────
async function seed() {
  console.log('🌱 开始写入演示数据...\n');

  // ── 1. 用户 ─────────────────────────────────────────────
  console.log('👤 写入用户...');
  const pw = await bcrypt.hash('123456', 10);
  const pwAdmin = await bcrypt.hash('admin123', 10);

  const users = [
    // role, username, nickname, company_code
    ['admin',    'admin',   '系统管理员', null],
    ['chef',     'chef01',  '张伟',        null],
    ['chef',     'chef02',  '李娜',        null],
    ['employee', 'emp001',  '王芳',        'A'],
    ['employee', 'emp002',  '刘洋',        'A'],
    ['employee', 'emp003',  '陈静',        'A'],
    ['employee', 'emp004',  '赵磊',        'B'],
    ['employee', 'emp005',  '孙丽',        'B'],
    ['employee', 'emp006',  '周强',        'B'],
    ['employee', 'emp007',  '吴敏',        'C'],
    ['employee', 'emp008',  '郑勇',        'C'],
    ['employee', 'emp009',  '黄霞',        'D'],
    ['employee', 'emp010',  '林峰',        'D'],
  ];

  const [companies] = await pool.query('SELECT id, code FROM companies');
  const codeToId = Object.fromEntries(companies.map(c => [c.code, c.id]));

  const userIds = {};
  for (const [role, username, nickname, code] of users) {
    const password = username === 'admin' ? pwAdmin : pw;
    const company_id = code ? codeToId[code] : null;
    const [res] = await pool.query(
      `INSERT IGNORE INTO users (username, password, nickname, role, company_id)
       VALUES (?, ?, ?, ?, ?)`,
      [username, password, nickname, role, company_id]
    );
    if (res.insertId) {
      userIds[username] = res.insertId;
    } else {
      const [[u]] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
      userIds[username] = u.id;
    }
  }
  console.log(`   ✅ ${users.length} 个用户`);

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
  const employees = ['emp001','emp002','emp003','emp004','emp005',
                     'emp006','emp007','emp008','emp009','emp010'];

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
    { user: 'emp001', dish: '麻辣小龙虾', desc: '夏天了，想吃小龙虾！', votes: 8 },
    { user: 'emp002', dish: '烤鸭饭',      desc: '北京烤鸭配米饭，超级期待',  votes: 12 },
    { user: 'emp003', dish: '酸菜鱼',      desc: '酸菜鱼汤鲜味美，强烈推荐',  votes: 6 },
    { user: 'emp004', dish: '剁椒鱼头',    desc: '湘菜经典，非常下饭',        votes: 5 },
    { user: 'emp005', dish: '佛跳墙',      desc: '高端食材，犒劳一下自己',    votes: 3 },
    { user: 'emp006', dish: '椰汁西米露',  desc: '饭后甜品，清凉解腻',       votes: 10 },
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
    [actId2, userIds['emp001'], '番茄炒蛋', '经典家常菜，百吃不厌', 20]
  );
  await pool.query(
    `INSERT IGNORE INTO wish_items (activity_id, user_id, dish_name, description, vote_count)
     VALUES (?, ?, ?, ?, ?)`,
    [actId2, userIds['emp003'], '糖醋鲤鱼', '酸甜开胃，节日首选', 8]
  );
  console.log('   ✅ 2 个许愿活动，6 条愿望');

  // ── 6. 充值申请 ──────────────────────────────────────────
  console.log('💳 写入充值记录...');
  const recharges = [
    { user: 'emp001', amount: 200, status: 'completed', remark: '本月餐费充值', review_note: '已到账', reviewer: 'admin' },
    { user: 'emp002', amount: 100, status: 'completed', remark: '',             review_note: '已到账', reviewer: 'admin' },
    { user: 'emp003', amount: 300, status: 'pending',   remark: '三个月餐费',   review_note: '',       reviewer: null },
    { user: 'emp004', amount: 150, status: 'pending',   remark: '微信转账',     review_note: '',       reviewer: null },
    { user: 'emp005', amount: 50,  status: 'rejected',  remark: '补充上月余额', review_note: '凭证模糊，请重新上传', reviewer: 'admin' },
    { user: 'emp007', amount: 200, status: 'completed', remark: '',             review_note: '已到账', reviewer: 'admin' },
    { user: 'emp009', amount: 100, status: 'pending',   remark: '支付宝转账',   review_note: '',       reviewer: null },
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
  console.log('  管理员  admin   / admin123');
  console.log('  厨师    chef01  / 123456');
  console.log('  员工    emp001~emp010 / 123456');
  await pool.end();
}

seed().catch(err => {
  console.error('❌ 写入失败:', err.message);
  process.exit(1);
});
