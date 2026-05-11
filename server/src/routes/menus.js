const express = require('express');
const router = express.Router();
const { getMenuByDate, getTodayMenu, getMenuList, createOrUpdateMenu, updateMenuStatus, deleteMenu } = require('../controllers/menuController');
const { authenticate, authorize } = require('../middlewares/auth');

// 所有已登录用户可查看
router.get('/today', authenticate, getTodayMenu);
router.get('/date/:date', authenticate, getMenuByDate);

// 管理员专属
router.get('/', authenticate, authorize('admin'), getMenuList);
router.post('/', authenticate, authorize('admin'), createOrUpdateMenu);
router.put('/:id/status', authenticate, authorize('admin'), updateMenuStatus);
router.delete('/:id', authenticate, authorize('admin'), deleteMenu);

module.exports = router;
