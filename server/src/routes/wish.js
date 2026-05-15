const express = require('express');
const router = express.Router();
const {
  getActivities, createActivity, updateActivity, closeActivity, reopenActivity,
  getWishItems, createWishItem, voteWishItem, unvoteWishItem, adoptWishItem,
  getComments, createComment, deleteComment
} = require('../controllers/wishController');
const { authenticate, authorize, requireConsoleUser, loadRbac, requirePermission } = require('../middlewares/auth');

router.get('/activities', authenticate, getActivities);
router.get('/activities/:activity_id/items', authenticate, getWishItems);

router.post('/activities', authenticate, requireConsoleUser, loadRbac, requirePermission('wish:manage'), createActivity);
router.put('/activities/:id/close', authenticate, requireConsoleUser, loadRbac, requirePermission('wish:manage'), closeActivity);
router.put('/activities/:id/reopen', authenticate, requireConsoleUser, loadRbac, requirePermission('wish:manage'), reopenActivity);
router.put('/activities/:id', authenticate, requireConsoleUser, loadRbac, requirePermission('wish:manage'), updateActivity);

router.post('/activities/:activity_id/items', authenticate, authorize('employee'), createWishItem);

router.post('/items/:item_id/vote', authenticate, voteWishItem);
router.delete('/items/:item_id/vote', authenticate, unvoteWishItem);

router.post('/items/:item_id/adopt', authenticate, requireConsoleUser, loadRbac, requirePermission('wish:manage'), adoptWishItem);

router.get('/items/:item_id/comments', authenticate, getComments);
router.post('/items/:item_id/comments', authenticate, createComment);
router.delete('/items/:item_id/comments/:comment_id', authenticate, deleteComment);

module.exports = router;
