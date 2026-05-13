import { Fragment } from 'react'
import { Navigate } from 'react-router-dom'
import { authStore } from '../store/authStore'

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
  /** 无权限时的跳转路径，默认 '/'（厨师访问仅管理员页面时会回首页） */
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
  deniedRedirect = '/',
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

  return <>{children}</>
}
