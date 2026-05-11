const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, resetUserPassword, getCompanies, createCompany, updateCompany } = require('../controllers/adminController');
const { authenticate, authorize } = require('../middlewares/auth');

const adminOnly = [authenticate, authorize('admin')];

// 用户管理
router.get('/users', ...adminOnly, getUsers);
router.post('/users', ...adminOnly, createUser);
router.put('/users/:id', ...adminOnly, updateUser);
router.put('/users/:id/reset-password', ...adminOnly, resetUserPassword);

// 公司管理
router.get('/companies', ...adminOnly, getCompanies);
router.post('/companies', ...adminOnly, createCompany);
router.put('/companies/:id', ...adminOnly, updateCompany);

module.exports = router;
