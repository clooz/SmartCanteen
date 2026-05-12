import { Form, Input, Button, Typography } from 'antd'
import { UserOutlined, LockOutlined, CoffeeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../api/auth'
import { authStore } from '../../store/authStore'

const { Text } = Typography

export default function LoginPage() {
  const [form] = Form.useForm()
  const navigate = useNavigate()

  const handleLogin = async (values: { username: string; password: string }) => {
    try {
      const res: any = await authApi.login(values)
      authStore.setAuth(res.data.token, res.data.user)
      navigate('/', { replace: true })
    } catch {
      // 错误已在拦截器统一处理
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__bg login-page__bg--one" />
      <div className="login-page__bg login-page__bg--two" />
      <div className="login-card">
        <div className="login-card__header">
          <div className="login-card__logo">
            <CoffeeOutlined />
          </div>
          <h1>登录 智能食堂</h1>
          <Text>欢迎使用管理系统</Text>
        </div>
        <Form form={form} onFinish={handleLogin} size="large" autoComplete="off" layout="vertical">
          <Form.Item
            name="username"
            label={<span className="login-shell__label">用户名</span>}
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined className="login-shell__input-icon" />}
              placeholder="请输入用户名"
              className="login-shell__input"
            />
          </Form.Item>
          <Form.Item
            name="password"
            label={<span className="login-shell__label">密码</span>}
            rules={[{ required: true, message: '请输入密码' }]}
            style={{ marginBottom: 24 }}
          >
            <Input.Password
              prefix={<LockOutlined className="login-shell__input-icon" />}
              placeholder="请输入密码"
              className="login-shell__input"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block className="login-shell__submit">
              登 录
            </Button>
          </Form.Item>
        </Form>
        <div className="login-shell__footer">
          <Text>© 2026 SmartCanteen</Text>
        </div>
      </div>
    </div>
  )
}
