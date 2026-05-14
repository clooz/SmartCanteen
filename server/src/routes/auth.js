const express = require('express');
const router = express.Router();
const {
  register,
  login,
  sendSmsCode,
  loginSms,
  getProfile,
  updateProfile,
  uploadAvatar,
  changePassword,
  getCompanies,
  getLegalVersion,
  bindPhone,
  sendBindPhoneCode,
  forgotSmsSend,
  forgotSmsReset,
  forgotEmailSend,
  forgotEmailReset,
} = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');
const upload = require('../utils/upload');

router.get('/companies', getCompanies);
router.get('/legal-version', getLegalVersion);
router.post('/register', register);
router.post('/login', login);
router.post('/sms/send', sendSmsCode);
router.post('/login-sms', loginSms);
router.post('/forgot/sms/send', forgotSmsSend);
router.post('/forgot/sms/reset', forgotSmsReset);
router.post('/forgot/email/send', forgotEmailSend);
router.post('/forgot/email/reset', forgotEmailReset);

router.get('/profile', authenticate, getProfile);
router.post('/profile/avatar', authenticate, upload.single('avatar'), uploadAvatar);
router.put('/profile', authenticate, updateProfile);
router.put('/profile/phone', authenticate, bindPhone);
router.post('/profile/phone/send-code', authenticate, sendBindPhoneCode);
router.put('/change-password', authenticate, changePassword);

module.exports = router;
