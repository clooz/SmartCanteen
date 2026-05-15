const express = require('express');
const router = express.Router();
const { createOrder, getOrderById, getMyOrders, getAllOrders, updateOrderStatus, getReport } = require('../controllers/orderController');
const { authenticate, authorize, requireConsoleUser, loadRbac, requirePermission } = require('../middlewares/auth');

router.post('/', authenticate, authorize('employee'), createOrder);
router.get('/my', authenticate, authorize('employee'), getMyOrders);

router.get('/', authenticate, requireConsoleUser, loadRbac, requirePermission('orders:read'), getAllOrders);
router.get('/report', authenticate, requireConsoleUser, loadRbac, requirePermission('orders:report'), getReport);

router.get('/:id', authenticate, getOrderById);
router.put('/:id/status', authenticate, loadRbac, updateOrderStatus);

module.exports = router;
