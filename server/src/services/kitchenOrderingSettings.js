const { pool } = require('../db/connection');

async function getKitchenOrderingSettings(conn) {
  const q = conn || pool;
  const [rows] = await q.query('SELECT * FROM kitchen_ordering_settings WHERE id = 1');
  if (!rows.length) {
    await q.query(
      `INSERT INTO kitchen_ordering_settings (id) VALUES (1)`
    );
    const [again] = await q.query('SELECT * FROM kitchen_ordering_settings WHERE id = 1');
    return again[0];
  }
  return rows[0];
}

async function updateKitchenOrderingSettings(body, conn) {
  const q = conn || pool;
  const fields = [];
  const vals = [];
  const map = [
    ['breakfast_order_start', 'breakfast_order_start'],
    ['breakfast_order_end', 'breakfast_order_end'],
    ['lunch_order_start', 'lunch_order_start'],
    ['lunch_order_end', 'lunch_order_end'],
  ];
  for (const [key, col] of map) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      fields.push(`${col} = ?`);
      const v = body[key];
      vals.push(v === '' || v == null ? null : String(v).trim());
    }
  }
  if (!fields.length) return getKitchenOrderingSettings(q);
  vals.push(1);
  await q.query(
    `UPDATE kitchen_ordering_settings SET ${fields.join(', ')} WHERE id = ?`,
    vals
  );
  return getKitchenOrderingSettings(q);
}

module.exports = { getKitchenOrderingSettings, updateKitchenOrderingSettings };
