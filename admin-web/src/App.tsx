import { useState, useEffect } from 'react'
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

  const toggleTheme = () => setThemeMode(prev => prev === 'light' ? 'dark' : 'light')

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: themeMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          // 主色：现代蓝
          colorPrimary: '#1677ff',
          colorLink: '#1677ff',
          colorLinkHover: '#4096ff',
          colorLinkActive: '#0958d9',

          // 圆角
          borderRadius: 8,
          borderRadiusLG: 10,
          borderRadiusSM: 6,
          borderRadiusXS: 4,

          // 字体：Inter + 中文降级
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
          fontSize: 14,
          fontSizeLG: 16,
          fontSizeHeading4: 18,
          fontSizeHeading3: 22,
          lineHeight: 1.6,

          // 间距
          padding: 16,
          paddingLG: 24,
          paddingSM: 12,
          paddingXS: 8,
          margin: 16,
          marginLG: 24,
          marginSM: 12,

          // 阴影 — 轻量、克制
          boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
          boxShadowSecondary: '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.04)',

          // 背景：极淡蓝灰
          colorBgLayout: '#F5F7FA',

          // 边框：更柔和
          colorBorder: '#E2E8F0',
          colorBorderSecondary: '#EEF2F7',

          // 控件高度
          controlHeight: 36,
          controlHeightLG: 42,
          controlHeightSM: 28,
        },
        components: {
          Button: {
            fontWeight: 500,
            primaryShadow: 'none',
          },
          Card: {
            paddingLG: 20,
            boxShadowTertiary: '0 1px 2px 0 rgba(0,0,0,0.04)',
          },
          Table: {
            headerBg: '#F8FAFC',
            headerColor: '#64748B',
            headerSortActiveBg: '#F8FAFC',
            rowHoverBg: '#F0F6FF',
            borderColor: '#EEF2F7',
            headerSplitColor: 'transparent',
          },
          Menu: {
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
            optionSelectedBg: '#EFF6FF',
          },
          Tag: {
            borderRadiusSM: 5,
          },
          Modal: {
            borderRadiusLG: 12,
          },
          Drawer: {
            borderRadius: 12,
          },
          Statistic: {
            titleFontSize: 13,
          },
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={
              <PrivateRoute roles={['admin', 'chef']}>
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
