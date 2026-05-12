const express = require('express');
const router = express.Router();
const { syncUsers, getUsers, createUser, updateUser, resetUserPassword, getCompanies, createCompany, updateCompany } = require('../controllers/adminController');
const { authenticate, authorize } = require('../middlewares/auth');

const adminOnly = [authenticate, authorize('admin')];

// 用户管理
router.get('/users', ...adminOnly, getUsers);
router.post('/users', ...adminOnly, createUser);
router.put('/users/:id', ...adminOnly, updateUser);
router.put('/users/:id/reset-password', ...adminOnly, resetUserPassword);

// 外部工作平台批量同步接口（钉钉/企微/飞书/自研HR等对接入口）
router.post('/users/sync', ...adminOnly, syncUsers);

// 公司管理
router.get('/companies', ...adminOnly, getCompanies);
router.post('/companies', ...adminOnly, createCompany);
router.put('/companies/:id', ...adminOnly, updateCompany);

module.exports = router;
