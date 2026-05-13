import { useState, useEffect, useMemo, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, App as AntApp, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { authStore } from './store/authStore'
import PrivateRoute from './components/PrivateRoute'
import AppLayout from './components/AppLayout'
import LoginPage from './pages/login/LoginPage'
import KitchenPage from './pages/kitchen/KitchenPage'
import DishesPage from './pages/dishes/DishesPage'
import MenusPage from './pages/menus/MenusPage'
import OrdersPage from './pages/orders/OrdersPage'
import ReportPage from './pages/report/ReportPage'
import UsersPage from './pages/users/UsersPage'
import CompaniesPage from './pages/companies/CompaniesPage'
import RechargePage from './pages/recharge/RechargePage'
import WishPage from './pages/wish/WishPage'
import './styles/global.css'

export type ThemeMode = 'light' | 'dark'

export type ThemeToggleOrigin = { clientX: number; clientY: number }

function prefersThemeTransitionReducedMotion() {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function HomeRedirect() {
  const user = authStore.getUser()
  return <Navigate to={user?.role === 'chef' ? '/kitchen' : '/kitchen'} replace />
}

export default function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('themeMode') as ThemeMode) || 'light'
  })

  useEffect(() => {
    localStorage.setItem('themeMode', themeMode)
    document.documentElement.setAttribute('data-theme', themeMode)
  }, [themeMode])

  const toggleTheme = useCallback((origin?: ThemeToggleOrigin) => {
    if (prefersThemeTransitionReducedMotion()) {
      setThemeMode(prev => (prev === 'light' ? 'dark' : 'light'))
      return
    }
    const root = document.documentElement
    const cx = origin?.clientX ?? (typeof window !== 'undefined' ? window.innerWidth / 2 : 0)
    const cy = origin?.clientY ?? (typeof window !== 'undefined' ? window.innerHeight / 2 : 0)
    root.style.setProperty('--theme-reveal-x', `${cx}px`)
    root.style.setProperty('--theme-reveal-y', `${cy}px`)

    const currentTheme = (root.getAttribute('data-theme') as ThemeMode | null) === 'dark' ? 'dark' : 'light'
    const revealKind = currentTheme === 'light' ? 'expand' : 'shrink'
    root.setAttribute('data-theme-reveal', revealKind)

    const doc = document as Document & {
      startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> }
    }
    if (!doc.startViewTransition) {
      setThemeMode(prev => (prev === 'light' ? 'dark' : 'light'))
      root.style.removeProperty('--theme-reveal-x')
      root.style.removeProperty('--theme-reveal-y')
      root.removeAttribute('data-theme-reveal')
      return
    }
    const vt = doc.startViewTransition(() => {
      flushSync(() => {
        setThemeMode(prev => (prev === 'light' ? 'dark' : 'light'))
      })
    })
    void vt.finished.finally(() => {
      root.style.removeProperty('--theme-reveal-x')
      root.style.removeProperty('--theme-reveal-y')
      root.removeAttribute('data-theme-reveal')
    })
  }, [])

  const appTheme = useMemo(
    () => ({
      algorithm: themeMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        colorPrimary: '#1677ff',
        colorLink: '#1677ff',
        colorLinkHover: '#4096ff',
        colorLinkActive: '#0958d9',
        borderRadius: 8,
        borderRadiusLG: 10,
        borderRadiusSM: 6,
        borderRadiusXS: 4,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
        fontSize: 14,
        fontSizeLG: 16,
        fontSizeHeading4: 18,
        fontSizeHeading3: 22,
        lineHeight: 1.6,
        padding: 16,
        paddingLG: 24,
        paddingSM: 12,
        paddingXS: 8,
        margin: 16,
        marginLG: 24,
        marginSM: 12,
        boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
        boxShadowSecondary: '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.04)',
        colorBgLayout: themeMode === 'dark' ? '#000000' : '#F5F7FA',
        colorBorder: themeMode === 'dark' ? '#303030' : '#E2E8F0',
        colorBorderSecondary: themeMode === 'dark' ? '#262626' : '#EEF2F7',
        controlHeight: 36,
        controlHeightLG: 42,
        controlHeightSM: 28,
      },
      components: {
        Button: { fontWeight: 500, primaryShadow: 'none' },
        Card: {
          paddingLG: 20,
          boxShadowTertiary: themeMode === 'dark'
            ? '0 1px 2px 0 rgba(0,0,0,0.45)'
            : '0 1px 2px 0 rgba(0,0,0,0.04)',
        },
        Table: themeMode === 'dark'
          ? {
              headerBg: '#1a1a1a',
              headerColor: 'rgba(255,255,255,0.45)',
              headerSortActiveBg: '#262626',
              rowHoverBg: 'rgba(22,119,255,0.12)',
              borderColor: '#303030',
              headerSplitColor: 'transparent',
            }
          : {
              headerBg: '#F8FAFC',
              headerColor: '#64748B',
              headerSortActiveBg: '#F8FAFC',
              rowHoverBg: '#F0F6FF',
              borderColor: '#EEF2F7',
              headerSplitColor: 'transparent',
            },
        Menu: themeMode === 'dark'
          ? {
              itemBorderRadius: 7,
              itemMarginInline: 8,
              subMenuItemBg: 'transparent',
              itemActiveBg: 'rgba(22,119,255,0.15)',
              itemSelectedBg: 'rgba(22,119,255,0.2)',
              itemSelectedColor: '#69b1ff',
            }
          : {
              itemBorderRadius: 7,
              itemMarginInline: 8,
              subMenuItemBg: 'transparent',
              itemActiveBg: '#EFF6FF',
              itemSelectedBg: '#EFF6FF',
              itemSelectedColor: '#1677ff',
            },
        Input: {
          activeShadow: '0 0 0 3px rgba(22,119,255,0.10)',
          borderRadius: 8,
        },
        Select: {
          optionSelectedBg: themeMode === 'dark' ? 'rgba(22,119,255,0.2)' : '#EFF6FF',
        },
        Tag: { borderRadiusSM: 5 },
        Modal: { borderRadiusLG: 12 },
        Drawer: { borderRadius: 12 },
        Statistic: { titleFontSize: 13 },
      },
    }),
    [themeMode],
  )

  return (
    <ConfigProvider
      locale={zhCN}
      theme={appTheme}
    >
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={
              <PrivateRoute
                roles={['admin', 'chef']}
                deniedRedirect="/login"
                clearOnDenied
              >
                <AppLayout themeMode={themeMode} onToggleTheme={toggleTheme} />
              </PrivateRoute>
            }>
              <Route index element={<HomeRedirect />} />
              <Route path="kitchen" element={<KitchenPage />} />
              <Route path="dishes" element={<DishesPage />} />
              <Route path="menus" element={<MenusPage />} />
              <Route path="wish" element={<WishPage />} />
              <Route path="orders" element={<PrivateRoute roles={['admin', 'chef']}><OrdersPage /></PrivateRoute>} />
              <Route path="report" element={<PrivateRoute roles={['admin', 'chef']}><ReportPage /></PrivateRoute>} />
              <Route path="recharge" element={<PrivateRoute roles={['admin']}><RechargePage /></PrivateRoute>} />
              <Route path="users" element={<PrivateRoute roles={['admin']}><UsersPage /></PrivateRoute>} />
              <Route path="companies" element={<PrivateRoute roles={['admin']}><CompaniesPage /></PrivateRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  )
}
