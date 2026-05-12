const express = require('express');
const router = express.Router();
const {
  getActivities, createActivity, closeActivity,
  getWishItems, createWishItem, voteWishItem, unvoteWishItem, adoptWishItem,
  getComments, createComment, deleteComment
} = require('../controllers/wishController');
const { authenticate, authorize } = require('../middlewares/auth');

// 所有已登录用户可查看活动和愿望
router.get('/activities', authenticate, getActivities);
router.get('/activities/:activity_id/items', authenticate, getWishItems);

// 管理员/厨师管理活动
router.post('/activities', authenticate, authorize('admin', 'chef'), createActivity);
router.put('/activities/:id/close', authenticate, authorize('admin', 'chef'), closeActivity);

// 员工提交许愿
router.post('/activities/:activity_id/items', authenticate, authorize('employee'), createWishItem);

// 所有登录用户可投票
router.post('/items/:item_id/vote', authenticate, voteWishItem);
router.delete('/items/:item_id/vote', authenticate, unvoteWishItem);

// 管理员/厨师采纳愿望
router.post('/items/:item_id/adopt', authenticate, authorize('admin', 'chef'), adoptWishItem);

// 评论（所有登录用户可查看和发评论，只能删自己的；管理员/厨师也可删）
router.get('/items/:item_id/comments', authenticate, getComments);
router.post('/items/:item_id/comments', authenticate, createComment);
router.delete('/items/:item_id/comments/:comment_id', authenticate, deleteComment);

module.exports = router;
