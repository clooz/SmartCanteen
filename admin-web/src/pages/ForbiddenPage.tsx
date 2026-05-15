import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'

export default function ForbiddenPage() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Result
        status="403"
        title="没有权限"
        subTitle="您没有访问该页面的权限，如需开通请联系超级管理员。"
        extra={(
          <Button type="primary" onClick={() => navigate('/', { replace: true })}>
            返回首页
          </Button>
        )}
      />
    </div>
  )
}
