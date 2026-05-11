import { useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Typography, Button, theme, Tooltip } from 'antd'
import {
  ShopOutlined, CalendarOutlined, UnorderedListOutlined,
  BarChartOutlined, TeamOutlined, BankOutlined, WalletOutlined,
  StarOutlined, LogoutOutlined, UserOutlined, CoffeeOutlined,
  SunOutlined, MoonOutlined,
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

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsed={collapsed}
        trigger={null}
        style={{
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          position: 'relative',
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: '0 16px',
        }}>
          <CoffeeOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
          {!collapsed && (
            <Text strong style={{ fontSize: 15, whiteSpace: 'nowrap' }}>
              智能食堂
            </Text>
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none', marginTop: 4, paddingBottom: 48 }}
        />

        {/* 自定义折叠按钮 */}
        <div
          onClick={() => setCollapsed(!collapsed)}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            color: token.colorTextSecondary,
            fontSize: 12,
            gap: 6,
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = token.colorPrimary)}
          onMouseLeave={e => (e.currentTarget.style.color = token.colorTextSecondary)}
        >
          {collapsed
            ? <><span style={{ fontSize: 14 }}>›</span></>
            : <><span style={{ fontSize: 14 }}>‹</span><span>收起</span></>
          }
        </div>
      </Sider>

      <Layout>
        <Header style={{
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
        }}>
          <Tooltip title={themeMode === 'light' ? '切换深色模式' : '切换浅色模式'}>
            <Button
              type="text"
              icon={themeMode === 'light' ? <MoonOutlined /> : <SunOutlined />}
              onClick={onToggleTheme}
            />
          </Tooltip>

          <Dropdown menu={userDropdown} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Avatar
                size="small"
                icon={<UserOutlined />}
                src={user?.avatar || undefined}
              />
              <Text>{user?.nickname || user?.username}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                ({user?.role === 'admin' ? '管理员' : '厨师'})
              </Text>
            </div>
          </Dropdown>
        </Header>

        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
