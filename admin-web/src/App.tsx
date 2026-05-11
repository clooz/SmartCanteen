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
  }, [themeMode])

  const toggleTheme = () => {
    setThemeMode(prev => prev === 'light' ? 'dark' : 'light')
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: themeMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          colorLink: '#1890ff',
          colorLinkHover: '#40a9ff',
          colorLinkActive: '#096dd9',
          colorBgLayout: '#f0f2f5',
          borderRadius: 6,
          fontFamily: "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
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
