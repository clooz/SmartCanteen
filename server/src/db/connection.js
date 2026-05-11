const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+08:00',
});

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL 数据库连接成功');
    conn.release();
  } catch (err) {
    console.error('❌ MySQL 数据库连接失败:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
