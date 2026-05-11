const jwt = require('jsonwebtoken');
const { fail } = require('../utils/response');

// 验证 JWT Token
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return fail(res, '未登录，请先登录', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return fail(res, 'Token 已过期或无效，请重新登录', 401);
  }
};

// 角色权限校验（传入允许的角色数组）
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return fail(res, '未登录', 401);
    }
    if (!roles.includes(req.user.role)) {
      return fail(res, '权限不足', 403);
    }
    next();
  };
};

module.exports = { authenticate, authorize };
