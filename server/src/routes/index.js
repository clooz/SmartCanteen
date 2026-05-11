const express = require('express');
const router = express.Router();

// 健康检查
router.get('/health', (req, res) => {
  res.json({ code: 0, message: 'SmartCanteen Server is running 🍽️', data: { time: new Date() } });
});

// 各模块路由
router.use('/auth', require('./auth'));
router.use('/dishes', require('./dishes'));
router.use('/menus', require('./menus'));
router.use('/orders', require('./orders'));
router.use('/wish', require('./wish'));
router.use('/recharge', require('./recharge'));
router.use('/admin', require('./admin'));

module.exports = router;
