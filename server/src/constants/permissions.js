/**
 * 管理端权限目录（单一事实来源）。数据库只存 key 字符串。
 * 与 docs/管理端_RBAC_权限方案.md 对齐。
 */

const PERMISSIONS = [
  { key: 'kitchen:view', module: 'kitchen', label: '实时订单', description: '查看厨房/实时订单' },
  { key: 'kitchen:order:update', module: 'kitchen', label: '厨房改单状态', description: '在厨房侧更新订单状态' },
  { key: 'dishes:read', module: 'dishes', label: '菜品查看', description: '查看菜品列表与详情' },
  { key: 'dishes:write', module: 'dishes', label: '菜品维护', description: '新增/编辑/删除菜品' },
  { key: 'menus:read', module: 'menus', label: '菜单查看', description: '查看菜单与订餐默认配置' },
  { key: 'menus:write', module: 'menus', label: '菜单维护', description: '创建/发布/删除菜单、改订餐默认' },
  { key: 'orders:read', module: 'orders', label: '订单列表', description: '查看全部订单' },
  { key: 'orders:report', module: 'orders', label: '消费报表', description: '查看消费统计报表' },
  { key: 'orders:status:update', module: 'orders', label: '订单状态', description: '后台更新订单状态（非员工取消）' },
  { key: 'wish:read', module: 'wish', label: '许愿查看', description: '查看许愿活动与条目' },
  { key: 'wish:manage', module: 'wish', label: '许愿管理', description: '管理活动、采纳愿望等' },
  { key: 'recharge:read', module: 'recharge', label: '充值查看', description: '查看充值申请列表' },
  { key: 'recharge:review', module: 'recharge', label: '充值审核', description: '审核通过/驳回充值' },
  { key: 'users:read', module: 'users', label: '用户查看', description: '查看用户列表' },
  { key: 'users:write', module: 'users', label: '用户维护', description: '创建/编辑用户、重置密码' },
  { key: 'users:sync', module: 'users', label: '用户同步', description: '外部平台批量同步用户' },
  { key: 'companies:read', module: 'companies', label: '公司查看', description: '查看公司列表' },
  { key: 'companies:write', module: 'companies', label: '公司维护', description: '创建/编辑公司' },
  { key: 'companies:delete', module: 'companies', label: '公司删除', description: '删除公司' },
  { key: 'rbac:role:manage', module: 'rbac', label: '角色与权限', description: '管理后台岗位及权限点' },
  { key: 'rbac:assign', module: 'rbac', label: '分配岗位', description: '为用户绑定后台岗位' },
  { key: 'audit:read', module: 'audit', label: '操作日志', description: '查看审计日志' },
];

const ALL_KEYS = PERMISSIONS.map((p) => p.key);

/** 系统管理员：除 RBAC 元操作与审计外的全部能力 */
const SYSTEM_ADMIN_KEYS = ALL_KEYS.filter(
  (k) => !k.startsWith('rbac:') && k !== 'audit:read',
);

/** 厨师包：与历史「厨师侧栏」能力对齐（不含用户/公司/充值审核；菜品写仍仅管理员，与旧接口一致） */
const CHEF_DEFAULT_KEYS = [
  'kitchen:view',
  'kitchen:order:update',
  'dishes:read',
  'menus:read',
  'menus:write',
  'orders:read',
  'orders:report',
  'orders:status:update',
  'wish:read',
  'wish:manage',
];

const SUPER_ADMIN_CODE = 'super_admin';
const SYSTEM_ADMIN_CODE = 'system_admin';
const CHEF_DEFAULT_CODE = 'chef_default';

/** 后台岗位 code 展示排序权重（越大越靠左） */
const ADMIN_ROLE_CODE_WEIGHT = {
  [SUPER_ADMIN_CODE]: 100,
  [SYSTEM_ADMIN_CODE]: 80,
  [CHEF_DEFAULT_CODE]: 50,
};

function adminRoleSortWeight(code) {
  if (!code) return 0;
  return ADMIN_ROLE_CODE_WEIGHT[code] ?? 10;
}

/** users.role 展示排序（越大越靠左） */
const USER_ROLE_WEIGHT = { admin: 30, chef: 20, employee: 10 };

module.exports = {
  PERMISSIONS,
  ALL_KEYS,
  SYSTEM_ADMIN_KEYS,
  CHEF_DEFAULT_KEYS,
  SUPER_ADMIN_CODE,
  SYSTEM_ADMIN_CODE,
  CHEF_DEFAULT_CODE,
  adminRoleSortWeight,
  USER_ROLE_WEIGHT,
};
