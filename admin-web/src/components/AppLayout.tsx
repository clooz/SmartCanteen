import { useState } from 'react'
import {
  Layout, Menu, Avatar, Dropdown, Button, theme, Tooltip, Breadcrumb, Drawer, Grid,
} from 'antd'
import {
  ShopOutlined, CalendarOutlined, UnorderedListOutlined,
  BarChartOutlined, TeamOutlined, BankOutlined, WalletOutlined,
  StarOutlined, LogoutOutlined, UserOutlined, CoffeeOutlined,
  SunOutlined, MoonOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  DownOutlined, HomeOutlined, ControlOutlined, MenuOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { authStore } from '../store/authStore'
import type { ThemeMode, ThemeToggleOrigin } from '../App'

const { Sider, Header, Content } = Layout

interface Props {
  themeMode: ThemeMode
  onToggleTheme: (origin?: ThemeToggleOrigin) => void
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
  { key: '/orders', icon: <UnorderedListOutlined />, label: '订单管理' },
  { key: '/report', icon: <BarChartOutlined />, label: '消费报表' },
  { key: '/wish', icon: <StarOutlined />, label: '许愿活动' },
]

export default function AppLayout({ themeMode, onToggleTheme }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const screens = Grid.useBreakpoint()
  const { token } = theme.useToken()
  const user = authStore.getUser()
  const isAdmin = user?.role === 'admin'
  const menuItems = isAdmin ? adminMenuItems : chefMenuItems
  const isDark = themeMode === 'dark'
  const isCompactNav = screens.lg === false

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

  const siderBg = isDark ? '#141414' : '#ffffff'
  const siderBorder = isDark ? '#2a2a2a' : '#EEF2F7'

  const closeMobileMenu = () => setMobileMenuOpen(false)

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={menuItems}
      onClick={({ key }) => {
        navigate(key)
        closeMobileMenu()
      }}
      style={{ border: 'none', background: 'transparent' }}
    />
  )

  const siderBody = (
    <>
      <div style={{
        height: 60,
        display: 'flex',
        alignItems: 'center',
        padding: collapsed ? '0' : '0 16px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 10,
        borderBottom: `1px solid ${siderBorder}`,
        flexShrink: 0,
      }}
      >
        <div style={{
          width: 32, height: 32,
          borderRadius: 9,
          background: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(22,119,255,0.35)',
        }}
        >
          <ControlOutlined style={{ color: '#fff', fontSize: 15 }} />
        </div>
        {!collapsed && (
          <div>
            <div style={{
              fontSize: 14,
              fontWeight: 700,
              color: token.colorText,
              lineHeight: 1.2,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
            }}
            >
              智能食堂
            </div>
            <div style={{
              fontSize: 11,
              color: token.colorTextTertiary,
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
            }}
            >
              管理控制台
            </div>
          </div>
        )}
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '8px 0',
        paddingBottom: 56,
      }}
      >
        {!collapsed && (
          <div style={{
            padding: '4px 20px 6px',
            fontSize: 10.5,
            fontWeight: 600,
            color: token.colorTextQuaternary,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
          >
            {isAdmin ? '功能导航' : '操作台'}
          </div>
        )}
        {menu}
      </div>

      <Button
        type="text"
        aria-expanded={!collapsed}
        aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
        onClick={() => setCollapsed(c => !c)}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 48,
          borderRadius: 0,
          borderTop: `1px solid ${siderBorder}`,
          color: token.colorTextTertiary,
          fontSize: 12,
          gap: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {collapsed
          ? <MenuUnfoldOutlined style={{ fontSize: 14 }} />
          : <><MenuFoldOutlined style={{ fontSize: 14 }} /><span style={{ fontWeight: 500 }}>收起</span></>}
      </Button>
    </>
  )

  const contentPadding = isCompactNav ? 16 : 24

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      {!isCompactNav && (
        <Sider
          collapsed={collapsed}
          trigger={null}
          width={220}
          collapsedWidth={64}
          style={{
            background: siderBg,
            borderRight: `1px solid ${siderBorder}`,
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflow: 'hidden',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {siderBody}
        </Sider>
      )}

      <Layout style={{
        background: token.colorBgLayout,
        overflow: 'auto',
        flex: 1,
        minWidth: 0,
      }}
      >
        <Header style={{
          background: token.colorBgContainer,
          borderBottom: `1px solid ${isDark ? '#2a2a2a' : '#EEF2F7'}`,
          padding: `0 ${contentPadding}px`,
          height: 60,
          lineHeight: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxShadow: 'none',
        }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {isCompactNav && (
              <Tooltip title="打开菜单">
                <Button
                  type="text"
                  icon={<MenuOutlined />}
                  aria-label="打开菜单"
                  onClick={() => setMobileMenuOpen(true)}
                  style={{ color: token.colorTextSecondary, flexShrink: 0 }}
                />
              </Tooltip>
            )}
            <Breadcrumb
              items={[
                {
                  title: (
                    <Tooltip title="首页">
                      <a
                        href="/"
                        onClick={(e) => {
                          e.preventDefault()
                          navigate('/')
                        }}
                        aria-label="返回首页"
                        style={{ color: token.colorTextSecondary, display: 'inline-flex', alignItems: 'center' }}
                      >
                        <HomeOutlined style={{ fontSize: 14 }} />
                      </a>
                    </Tooltip>
                  ),
                },
              ]}
              style={{ lineHeight: 1 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tooltip title={themeMode === 'light' ? '深色模式' : '浅色模式'}>
              <Button
                type="text"
                icon={themeMode === 'light' ? <MoonOutlined /> : <SunOutlined />}
                onClick={(e) => onToggleTheme({ clientX: e.clientX, clientY: e.clientY })}
                aria-label={themeMode === 'light' ? '切换到深色模式' : '切换到浅色模式'}
                style={{
                  color: token.colorTextSecondary,
                  borderRadius: 8,
                }}
              />
            </Tooltip>

            <div style={{ width: 1, height: 20, background: token.colorBorderSecondary, margin: '0 4px' }} />

            <Dropdown menu={userDropdown} placement="bottomRight" trigger={['click']}>
              <Button
                type="text"
                aria-haspopup="menu"
                style={{
                  height: 'auto',
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 8,
                }}
              >
                <Avatar
                  size={28}
                  icon={<UserOutlined />}
                  src={user?.avatar || undefined}
                  style={{ background: token.colorPrimary, flexShrink: 0, fontSize: 12 }}
                />
                <div style={{ lineHeight: 1.4, textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: token.colorText, whiteSpace: 'nowrap' }}>
                    {user?.nickname || user?.username}
                  </div>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary, whiteSpace: 'nowrap' }}>
                    {user?.role === 'admin' ? '管理员' : '厨师'}
                  </div>
                </div>
                <DownOutlined style={{ fontSize: 10, color: token.colorTextQuaternary }} />
              </Button>
            </Dropdown>
          </div>
        </Header>

        <Content style={{ padding: contentPadding, minHeight: 0 }}>
          <Outlet />
        </Content>
      </Layout>

      <Drawer
        title={(
          <span style={{ fontWeight: 600, color: token.colorText }}>智能食堂</span>
        )}
        placement="left"
        width={260}
        onClose={closeMobileMenu}
        open={isCompactNav && mobileMenuOpen}
        styles={{ body: { padding: '8px 0' } }}
      >
        {menu}
      </Drawer>
    </Layout>
  )
}
