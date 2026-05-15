const express = require('express');
const router = express.Router();
const {
  syncUsers,
  getUsers,
  listAdminRolesBrief,
  createUser,
  updateUser,
  resetUserPassword,
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
} = require('../controllers/adminController');
const rbac = require('../controllers/rbacController');
const {
  authenticate,
  requireConsoleUser,
  loadRbac,
  requirePermission,
} = require('../middlewares/auth');

const c = (...perms) => [authenticate, requireConsoleUser, loadRbac, requirePermission(...perms)];

router.get('/lookup/admin-roles', ...c('users:read'), listAdminRolesBrief);

// 用户管理
router.get('/users', ...c('users:read'), getUsers);
router.post('/users', ...c('users:write'), createUser);
router.put('/users/:id', ...c('users:write'), updateUser);
router.put('/users/:id/reset-password', ...c('users:write'), resetUserPassword);
router.post('/users/sync', ...c('users:sync'), syncUsers);

// 公司管理
router.get('/companies', ...c('companies:read'), getCompanies);
router.post('/companies', ...c('companies:write'), createCompany);
router.put('/companies/:id', ...c('companies:write'), updateCompany);
router.delete('/companies/:id', ...c('companies:delete'), deleteCompany);

// RBAC（仅超级管理员）
const superOnly = [authenticate, requireConsoleUser, loadRbac, rbac.requireSuper];
router.get('/rbac/roles', ...superOnly, rbac.listRoles);
router.get('/rbac/roles/:id/members', ...superOnly, rbac.listRoleMembers);
router.get('/rbac/permissions', ...superOnly, rbac.getPermissionCatalog);
router.post('/rbac/roles', ...superOnly, rbac.createRole);
router.put('/rbac/roles/:id', ...superOnly, rbac.updateRoleMeta);
router.delete('/rbac/roles/:id', ...superOnly, rbac.deleteRole);
router.get('/rbac/roles/:id/permissions', ...superOnly, rbac.getRolePermissions);
router.put('/rbac/roles/:id/permissions', ...superOnly, rbac.updateRolePermissions);
router.get('/rbac/audit-logs', ...superOnly, rbac.listAuditLogs);
router.get('/rbac/roles-for-assign', ...superOnly, rbac.listRolesForAssign);

module.exports = router;
