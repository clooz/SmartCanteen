const express = require('express');
const router = express.Router();
const { getMenuByDate, getTodayMenu, getMenuList, createOrUpdateMenu, updateMenuStatus, deleteMenu } = require('../controllers/menuController');
const { authenticate, authorize } = require('../middlewares/auth');

// 所有已登录用户可查看
router.get('/today', authenticate, getTodayMenu);
router.get('/date/:date', authenticate, getMenuByDate);

// 管理端角色可操作（管理员 + 厨师）
router.get('/', authenticate, authorize('admin', 'chef'), getMenuList);
router.post('/', authenticate, authorize('admin', 'chef'), createOrUpdateMenu);
router.put('/:id/status', authenticate, authorize('admin', 'chef'), updateMenuStatus);
router.delete('/:id', authenticate, authorize('admin', 'chef'), deleteMenu);

module.exports = router;
