const express = require('express');
const router = express.Router();
const { register, login, getProfile, updateProfile, uploadAvatar, changePassword, getCompanies } = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');
const upload = require('../utils/upload');

// 公开接口（无需登录）
router.get('/companies', getCompanies);       // 获取公司列表
router.post('/register', register);            // 员工注册
router.post('/login', login);                  // 登录

// 需要登录的接口
router.get('/profile', authenticate, getProfile);             // 获取个人信息
router.post('/profile/avatar', authenticate, upload.single('avatar'), uploadAvatar); // 上传头像
router.put('/profile', authenticate, updateProfile);          // 修改个人信息
router.put('/change-password', authenticate, changePassword); // 修改密码

module.exports = router;
