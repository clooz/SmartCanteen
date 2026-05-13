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

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 服务器已启动: http://localhost:${PORT}（局域网请用本机 IPv4 访问）`);
    console.log(`📡 健康检查: http://localhost:${PORT}/api/health`);
    startOrderingScheduler();
  });
}

start();
