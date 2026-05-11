const express = require('express');
const router = express.Router();
const { createRecharge, getMyRecharges, getAllRecharges, reviewRecharge } = require('../controllers/rechargeController');
const { authenticate, authorize } = require('../middlewares/auth');
const upload = require('../utils/upload');

// 员工接口
router.post('/', authenticate, authorize('employee'), upload.single('proof_image'), createRecharge);
router.get('/my', authenticate, authorize('employee'), getMyRecharges);

// 管理员接口
router.get('/', authenticate, authorize('admin'), getAllRecharges);
router.put('/:id/review', authenticate, authorize('admin'), reviewRecharge);

module.exports = router;
