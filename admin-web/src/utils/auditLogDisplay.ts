/** 管理端操作日志：动作与详情的中文展示（面向运营，非技术字段名） */

const ACTION_LABELS: Record<string, string> = {
  role_created: '新建角色',
  role_meta_updated: '修改角色信息',
  role_deleted: '删除角色',
  role_permissions_updated: '调整角色权限',
  user_admin_role_changed: '变更用户角色',
  recharge_reviewed: '审核充值申请',
}

const RECHARGE_STATUS_LABELS: Record<string, string> = {
  completed: '通过',
  rejected: '驳回',
  pending: '待处理',
}

function parseDetail(raw: unknown): Record<string, unknown> | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw !== 'string') return null
  try {
    const o = JSON.parse(raw)
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function permLabels(keys: unknown, labelByKey: Map<string, string>): string[] {
  if (!Array.isArray(keys)) return []
  return keys
    .filter((k): k is string => typeof k === 'string' && k.length > 0)
    .map((k) => labelByKey.get(k) ?? k)
}

/** 动作列：技术 action → 中文简述 */
export function formatAuditAction(action: string): string {
  return ACTION_LABELS[action] ?? '其他操作'
}

/** 详情列：detail_json → 中文说明 */
export function formatAuditDetail(
  action: string,
  detailJson: unknown,
  labelByKey: Map<string, string> = new Map(),
): string {
  const d = parseDetail(detailJson)
  if (!d) {
    if (typeof detailJson === 'string' && detailJson.trim()) return detailJson.trim()
    return '—'
  }

  switch (action) {
    case 'role_created': {
      const code = d.code != null ? String(d.code) : ''
      if (code) return `新建了角色「${code}」`
      return '新建了一个自定义角色'
    }
    case 'role_meta_updated':
      return '修改了角色的名称或说明'
    case 'role_deleted':
      return '删除了一个自定义角色'
    case 'role_permissions_updated': {
      const labels = permLabels(d.keys, labelByKey)
      if (!labels.length) return '保存了角色的功能权限配置'
      if (labels.length <= 4) {
        return `调整了角色权限，包含：${labels.join('、')}`
      }
      return `调整了角色权限，共 ${labels.length} 项，含 ${labels.slice(0, 3).join('、')} 等`
    }
    case 'user_admin_role_changed': {
      const arid = d.admin_role_id
      if (arid === null || arid === '' || arid === undefined) {
        return '将某用户改为仅点餐用户，并取消其后台角色'
      }
      return '在用户管理中为该用户指定了新的后台角色'
    }
    case 'recharge_reviewed': {
      const st = d.status != null ? String(d.status) : ''
      const stLabel = RECHARGE_STATUS_LABELS[st] ?? st
      if (stLabel === '通过') return '审核通过了一条充值申请'
      if (stLabel === '驳回') return '驳回了一条充值申请'
      return '处理了一条充值申请'
    }
    default: {
      const parts = Object.entries(d)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => {
          if (k === 'keys' && Array.isArray(v)) {
            const labels = permLabels(v, labelByKey)
            return labels.length ? `权限：${labels.join('、')}` : ''
          }
          return `${k}：${String(v)}`
        })
        .filter(Boolean)
      return parts.length ? parts.join('；') : '—'
    }
  }
}
