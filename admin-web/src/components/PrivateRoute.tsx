import { Fragment } from 'react'
import { Navigate } from 'react-router-dom'
import { authStore, userHasAnyPermission, userHasPermission } from '../store/authStore'

/** 路由重定向前短暂显示，避免 <Navigate /> 在首帧为 null 时整页纯白 */
function RedirectSplash() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f5f7fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#64748b',
        fontSize: 14,
      }}
    >
      正在跳转…
    </div>
  )
}

interface Props {
  children: React.ReactNode
  roles?: string[]
  /** 需同时具备所有列出的权限点 */
  permission?: string
  /** 具备任一权限点即可 */
  anyOfPermissions?: string[]
  /** 仅超级管理员（登录响应 is_super_admin） */
  superAdminOnly?: boolean
  /** 无权限时的跳转路径，默认 '/403' */
  deniedRedirect?: string
  /**
   * 无权限时是否清除本地登录态。
   * 根布局（仅 admin/chef）必须开启：否则 employee 等角色会被 Navigate 到 '/' 再次命中同一守卫，形成无限重定向 → 白屏。
   */
  clearOnDenied?: boolean
}

export default function PrivateRoute({
  children,
  roles,
  permission,
  anyOfPermissions,
  superAdminOnly,
  deniedRedirect = '/403',
  clearOnDenied = false,
}: Props) {
  const user = authStore.getUser()

  if (!authStore.isLoggedIn() || !user) {
    return (
      <Fragment>
        <RedirectSplash />
        <Navigate to="/login" replace />
      </Fragment>
    )
  }

  if (roles && (!user.role || !roles.includes(user.role))) {
    if (clearOnDenied) {
      authStore.clear()
    }
    return (
      <Fragment>
        <RedirectSplash />
        <Navigate to={deniedRedirect} replace />
      </Fragment>
    )
  }

  if (superAdminOnly && !user.is_super_admin) {
    return (
      <Fragment>
        <RedirectSplash />
        <Navigate to={deniedRedirect} replace />
      </Fragment>
    )
  }

  /** 超管与后端一致视为具备全部权限点（避免旧 localStorage 无 permissions 数组时无法进用户管理等页） */
  if (permission && !user.is_super_admin && !userHasPermission(user, permission)) {
    return (
      <Fragment>
        <RedirectSplash />
        <Navigate to={deniedRedirect} replace />
      </Fragment>
    )
  }

  if (anyOfPermissions?.length && !user.is_super_admin && !userHasAnyPermission(user, anyOfPermissions)) {
    return (
      <Fragment>
        <RedirectSplash />
        <Navigate to={deniedRedirect} replace />
      </Fragment>
    )
  }

  return <>{children}</>
}
