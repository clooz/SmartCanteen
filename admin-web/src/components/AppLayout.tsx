import { useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Typography, Button, theme, Tooltip } from 'antd'
import {
  ShopOutlined, CalendarOutlined, UnorderedListOutlined,
  BarChartOutlined, TeamOutlined, BankOutlined, WalletOutlined,
  StarOutlined, LogoutOutlined, UserOutlined, CoffeeOutlined,
  SunOutlined, MoonOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  DownOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { authStore } from '../store/authStore'
import type { ThemeMode } from '../App'

const { Sider, Header, Content } = Layout
const { Text } = Typography

interface Props {
  themeMode: ThemeMode
  onToggleTheme: () => void
}

const adminMenuItems = [
  { key: '/kitchen', icon: <CoffeeOutlined />, label: '实时订单' },
  { key: '/dishes', icon: <ShopOutlined />, label: '菜品管理' },
  { key: '/menus', icon: <CalendarOutlined />, label: '菜单管理' },
  { key: '/orders', icon: <UnorderedListOutlined />, label: '订单管理' },
  { key: '/report', icon: <BarChartOutlined />, label: '消费报表' },
  { key: '/wish', icon: <StarOutlined />, label: '许愿活动' },
  { key: '/recharge', icon: <WalletOutlined />, label: '充值审核' },
  { key: '/users', icon: <TeamOutlined />, label: '用户管理' },
  { key: '/companies', icon: <BankOutlined />, label: '公司管理' },
]

const chefMenuItems = [
  { key: '/kitchen', icon: <CoffeeOutlined />, label: '实时订单' },
  { key: '/dishes', icon: <ShopOutlined />, label: '菜品管理' },
  { key: '/menus', icon: <CalendarOutlined />, label: '菜单管理' },
  { key: '/wish', icon: <StarOutlined />, label: '许愿活动' },
]

export default function AppLayout({ themeMode, onToggleTheme }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()
  const user = authStore.getUser()
  const isAdmin = user?.role === 'admin'
  const menuItems = isAdmin ? adminMenuItems : chefMenuItems

  const currentPage = [...adminMenuItems, ...chefMenuItems].find(
    item => item.key === location.pathname
  )

  const handleLogout = () => {
    authStore.clear()
    navigate('/login')
  }

  const userDropdown = {
    items: [
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'logout') handleLogout()
    },
  }

  const isDark = themeMode === 'dark'

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      {/* 侧边栏 */}
      <Sider
        collapsed={collapsed}
        trigger={null}
        width={220}
        collapsedWidth={64}
        style={{
          background: isDark ? '#141414' : '#fff',
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          padding: collapsed ? '0' : '0 20px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 10,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          flexShrink: 0,
        }}>
          <div style={{
            width: 30, height: 30,
            borderRadius: 8,
            background: token.colorPrimary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <CoffeeOutlined style={{ color: '#fff', fontSize: 15 }} />
          </div>
          {!collapsed && (
            <Text strong style={{ fontSize: 15, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
              智能食堂
            </Text>
          )}
        </div>

        {/* 菜单 */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: 8, paddingBottom: 56 }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ border: 'none' }}
          />
        </div>

        {/* 折叠按钮 */}
        <div
          onClick={() => setCollapsed(!collapsed)}
          style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            color: token.colorTextTertiary,
            fontSize: 13,
            gap: 6,
            userSelect: 'none',
            transition: 'color 0.2s, background 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = token.colorPrimary
            e.currentTarget.style.background = token.colorPrimaryBg
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = token.colorTextTertiary
            e.currentTarget.style.background = 'transparent'
          }}
        >
          {collapsed
            ? <MenuUnfoldOutlined style={{ fontSize: 14 }} />
            : <><MenuFoldOutlined style={{ fontSize: 14 }} /><span>收起</span></>
          }
        </div>
      </Sider>

      <Layout style={{
        background: token.colorBgLayout,
        overflow: 'auto',
        flex: 1,
      }}>
        {/* 顶部栏 */}
        <Header style={{
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: '0 24px',
          height: 56,
          lineHeight: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          {/* 页面标题 */}
          <Text strong style={{ fontSize: 15, color: token.colorTextHeading }}>
            {currentPage?.label || '控制台'}
          </Text>

          {/* 右侧操作区 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tooltip title={themeMode === 'light' ? '深色模式' : '浅色模式'}>
              <Button
                type="text"
                icon={themeMode === 'light' ? <MoonOutlined /> : <SunOutlined />}
                onClick={onToggleTheme}
                style={{ color: token.colorTextSecondary }}
              />
            </Tooltip>

            <Dropdown menu={userDropdown} placement="bottomRight">
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '6px 12px 6px 8px',
                borderRadius: 8,
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = token.colorFillTertiary)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Avatar
                  size={28}
                  icon={<UserOutlined />}
                  src={user?.avatar || undefined}
                  style={{ background: token.colorPrimary, flexShrink: 0 }}
                />
                <div style={{ lineHeight: 1.4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: token.colorText, whiteSpace: 'nowrap' }}>
                    {user?.nickname || user?.username}
                  </div>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary, whiteSpace: 'nowrap' }}>
                    {user?.role === 'admin' ? '管理员' : '厨师'}
                  </div>
                </div>
                <DownOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* 内容区 */}
        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
