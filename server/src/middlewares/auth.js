const jwt = require('jsonwebtoken');
const { fail } = require('../utils/response');
const { resolveUserRbac } = require('../services/rbacService');

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

/** 可登录管理端的身份 */
const requireConsoleUser = (req, res, next) => {
  if (!req.user) return fail(res, '未登录', 401);
  if (!['chef', 'admin'].includes(req.user.role)) {
    return fail(res, '权限不足', 403);
  }
  next();
};

/** 将后台权限解析到 req.rbac */
const loadRbac = async (req, res, next) => {
  if (!req.user) return fail(res, '未登录', 401);
  try {
    req.rbac = await resolveUserRbac(req.user.id);
    next();
  } catch (e) {
    console.error('loadRbac', e);
    return fail(res, '服务器错误', 500);
  }
};

const requirePermission = (...keys) => (req, res, next) => {
  if (!req.rbac) return fail(res, '服务配置错误', 500);
  for (const k of keys) {
    if (req.rbac.permissionSet.has(k)) return next();
  }
  return fail(res, '权限不足', 403);
};

/** 小程序用户放行；管理端用户需具备任一权限 */
const allowEmployeeOrPermission = (...keys) => (req, res, next) => {
  if (!req.user) return fail(res, '未登录', 401);
  if (req.user.role === 'employee') return next();
  if (!req.rbac) return fail(res, '服务配置错误', 500);
  for (const k of keys) {
    if (req.rbac.permissionSet.has(k)) return next();
  }
  return fail(res, '权限不足', 403);
};

module.exports = {
  authenticate,
  authorize,
  requireConsoleUser,
  loadRbac,
  requirePermission,
  allowEmployeeOrPermission,
};
