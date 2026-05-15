const express = require('express');
const router = express.Router();
const { getDishes, getDishById, createDish, updateDish, deleteDish, getCategories } = require('../controllers/dishController');
const {
  authenticate,
  requireConsoleUser,
  loadRbac,
  requirePermission,
  allowEmployeeOrPermission,
} = require('../middlewares/auth');
const upload = require('../utils/upload');

router.get('/', authenticate, loadRbac, allowEmployeeOrPermission('dishes:read'), getDishes);
router.get('/categories', authenticate, loadRbac, allowEmployeeOrPermission('dishes:read'), getCategories);
router.get('/:id', authenticate, loadRbac, allowEmployeeOrPermission('dishes:read'), getDishById);

router.post('/', authenticate, requireConsoleUser, loadRbac, requirePermission('dishes:write'), upload.single('image'), createDish);
router.put('/:id', authenticate, requireConsoleUser, loadRbac, requirePermission('dishes:write'), upload.single('image'), updateDish);
router.delete('/:id', authenticate, requireConsoleUser, loadRbac, requirePermission('dishes:write'), deleteDish);

module.exports = router;
