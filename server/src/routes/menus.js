const express = require('express');
const router = express.Router();
const { getMenuByDate, getTodayMenu, getMenuList, createOrUpdateMenu, updateMenuStatus, deleteMenu } = require('../controllers/menuController');
const { getOrderingDefaults, updateOrderingDefaults } = require('../controllers/orderingDefaultsController');
const {
  authenticate,
  requireConsoleUser,
  loadRbac,
  requirePermission,
} = require('../middlewares/auth');

router.get('/today', authenticate, getTodayMenu);
router.get('/date/:date', authenticate, getMenuByDate);

router.get('/ordering-defaults', authenticate, requireConsoleUser, loadRbac, requirePermission('menus:read'), getOrderingDefaults);
router.put('/ordering-defaults', authenticate, requireConsoleUser, loadRbac, requirePermission('menus:write'), updateOrderingDefaults);

router.get('/', authenticate, requireConsoleUser, loadRbac, requirePermission('menus:read'), getMenuList);
router.post('/', authenticate, requireConsoleUser, loadRbac, requirePermission('menus:write'), createOrUpdateMenu);
router.put('/:id/status', authenticate, requireConsoleUser, loadRbac, requirePermission('menus:write'), updateMenuStatus);
router.delete('/:id', authenticate, requireConsoleUser, loadRbac, requirePermission('menus:write'), deleteMenu);

module.exports = router;
