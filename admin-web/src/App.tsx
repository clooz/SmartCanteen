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
          // 主色：拂晓蓝
          colorPrimary: '#1890ff',
          colorLink: '#1890ff',
          colorLinkHover: '#40a9ff',
          colorLinkActive: '#096dd9',

          // 圆角：现代感
          borderRadius: 8,
          borderRadiusLG: 12,
          borderRadiusSM: 6,
          borderRadiusXS: 4,

          // 字体
          fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
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

          // 阴影
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)',
          boxShadowSecondary: '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)',

          // 背景
          colorBgLayout: '#f5f7fa',

          // 边框
          colorBorder: '#e5e7eb',
          colorBorderSecondary: '#f3f4f6',

          // 控件高度
          controlHeight: 36,
          controlHeightLG: 42,
          controlHeightSM: 28,
        },
        components: {
          Button: {
            fontWeight: 500,
            primaryShadow: '0 2px 8px rgba(24,144,255,0.35)',
          },
          Card: {
            paddingLG: 20,
          },
          Table: {
            headerBg: '#fafafa',
            headerColor: '#6b7280',
            headerSortActiveBg: '#fafafa',
            rowHoverBg: '#f0f7ff',
            borderColor: '#f0f0f0',
          },
          Menu: {
            itemBorderRadius: 8,
            itemMarginInline: 8,
            subMenuItemBg: 'transparent',
          },
          Input: {
            activeShadow: '0 0 0 2px rgba(24,144,255,0.12)',
          },
          Select: {
            optionSelectedBg: '#e6f4ff',
          },
          Tag: {
            borderRadiusSM: 6,
          },
          Modal: {
            borderRadiusLG: 12,
          },
          Drawer: {
            borderRadius: 12,
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
              <Route path="orders" element={<PrivateRoute roles={['admin']}><OrdersPage /></PrivateRoute>} />
              <Route path="report" element={<PrivateRoute roles={['admin']}><ReportPage /></PrivateRoute>} />
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
