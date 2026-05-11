import { Navigate } from 'react-router-dom'
import { authStore } from '../store/authStore'

interface Props {
  children: React.ReactNode
  roles?: string[]
}

export default function PrivateRoute({ children, roles }: Props) {
  const user = authStore.getUser()

  if (!authStore.isLoggedIn() || !user) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
