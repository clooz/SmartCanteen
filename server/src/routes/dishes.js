const express = require('express');
const router = express.Router();
const { getDishes, getDishById, createDish, updateDish, deleteDish, getCategories } = require('../controllers/dishController');
const { authenticate, authorize } = require('../middlewares/auth');
const upload = require('../utils/upload');

// 公开接口（已登录用户可访问）
router.get('/', authenticate, getDishes);
router.get('/categories', authenticate, getCategories);
router.get('/:id', authenticate, getDishById);

// 管理员专属接口
router.post('/', authenticate, authorize('admin'), upload.single('image'), createDish);
router.put('/:id', authenticate, authorize('admin'), upload.single('image'), updateDish);
router.delete('/:id', authenticate, authorize('admin'), deleteDish);

module.exports = router;
