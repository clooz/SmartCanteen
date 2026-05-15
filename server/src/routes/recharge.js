const express = require('express');
const router = express.Router();
const { createRecharge, getMyRecharges, getAllRecharges, reviewRecharge } = require('../controllers/rechargeController');
const { authenticate, authorize, requireConsoleUser, loadRbac, requirePermission } = require('../middlewares/auth');
const upload = require('../utils/upload');

router.post('/', authenticate, authorize('employee'), upload.single('proof_image'), createRecharge);
router.get('/my', authenticate, authorize('employee'), getMyRecharges);

router.get('/', authenticate, requireConsoleUser, loadRbac, requirePermission('recharge:read'), getAllRecharges);
router.put('/:id/review', authenticate, requireConsoleUser, loadRbac, requirePermission('recharge:review'), reviewRecharge);

module.exports = router;
