require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const { testConnection } = require('./db/connection');
const { initDatabase } = require('./db/init');
const routes = require('./routes/index');
const { startOrderingScheduler } = require('./schedulers/orderingScheduler');

const app = express();
const httpServer = http.createServer(app);

// Socket.io 配置（供后续厨房实时推送使用）
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// 将 io 实例挂载到 app，方便在 controller 中使用
app.set('io', io);

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件（菜品图片等上传文件）
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// 根路径：纯 API 服务，无管理端页面（管理端请运行 admin-web）
app.get('/', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"/><title>SmartCanteen API</title></head>
<body style="font-family:system-ui,sans-serif;padding:2rem;max-width:40rem;line-height:1.6">
  <h1>SmartCanteen 后端</h1>
  <p>此处仅提供 HTTP API，根路径没有网页。</p>
  <ul>
    <li><a href="/api/health">健康检查</a> <code>GET /api/health</code></li>
    <li>业务接口前缀：<code>/api</code>（如登录 <code>POST /api/auth/login</code>）</li>
  </ul>
  <p><strong>管理后台</strong>：请在项目里单独启动 <code>admin-web</code>（Vite 开发服或构建后的静态站），并将前端的 API 地址指向本服务。</p>
</body>
</html>`);
});

// API 路由
app.use('/api', routes);

// Socket.io 连接事件
io.on('connection', (socket) => {
  console.log(`🔌 Socket 客户端已连接: ${socket.id}`);

  socket.on('join_kitchen', () => {
    socket.join('kitchen');
    console.log(`👨‍🍳 厨师端已加入 kitchen 房间: ${socket.id}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket 客户端已断开: ${socket.id}`);
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;

async function start() {
  await testConnection();
  await initDatabase();

  httpServer.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`\n❌ 端口 ${PORT} 已被占用，本进程无法启动。`);
      console.error('   请先结束占用该端口的旧 Node 进程，例如：');
      console.error(`   netstat -ano | findstr ":${PORT}"`);
      console.error('   记下 LISTENING 行最后一列 PID，再执行：taskkill /PID <PID> /F\n');
      process.exit(1);
    }
    throw err;
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 服务器已启动: http://localhost:${PORT}（局域网请用本机 IPv4 访问）`);
    console.log(`📡 健康检查: http://localhost:${PORT}/api/health`);
    startOrderingScheduler();
  });
}

start();
