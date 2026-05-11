const express = require('express');
const router = express.Router();
const { createOrder, getOrderById, getMyOrders, getAllOrders, updateOrderStatus, getReport } = require('../controllers/orderController');
const { authenticate, authorize } = require('../middlewares/auth');

// 员工接口
router.post('/', authenticate, authorize('employee'), createOrder);
router.get('/my', authenticate, authorize('employee'), getMyOrders);

// 厨师 + 管理员接口
router.get('/', authenticate, authorize('chef', 'admin'), getAllOrders);

// 管理员报表
router.get('/report', authenticate, authorize('admin'), getReport);

// 通用接口（权限在 controller 内判断）
router.get('/:id', authenticate, getOrderById);
router.put('/:id/status', authenticate, updateOrderStatus);

module.exports = router;
