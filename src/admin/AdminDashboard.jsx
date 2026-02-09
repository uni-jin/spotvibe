import { useState, useEffect } from 'react'
import AdminLogin from './AdminLogin'
import AdminLayout from './AdminLayout'
import { verifyAdminToken } from '../lib/admin'
import UsersManagement from './components/UsersManagement'
import PlacesManagement from './components/PlacesManagement'
import CustomPlacesManagement from './components/CustomPlacesManagement'
import SettingsManagement from './components/SettingsManagement'

const AdminDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentMenu, setCurrentMenu] = useState('places')
  const [admin, setAdmin] = useState(null)

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('admin_token')
      if (!token) {
        setIsAuthenticated(false)
        return
      }

      const { valid, admin: adminData } = await verifyAdminToken(token)
      if (valid && adminData) {
        setIsAuthenticated(true)
        setAdmin(adminData)
      } else {
        localStorage.removeItem('admin_token')
        setIsAuthenticated(false)
      }
    }

    checkAuth()
  }, [])

  const handleLoginSuccess = (token) => {
    setIsAuthenticated(true)
    // Admin data will be loaded in AdminLayout
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    setIsAuthenticated(false)
    setAdmin(null)
  }

  if (!isAuthenticated) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />
  }

  const renderContent = () => {
    switch (currentMenu) {
      case 'users':
        return <UsersManagement />
      case 'places':
        return <PlacesManagement />
      case 'custom-places':
        return <CustomPlacesManagement />
      case 'settings':
        return <SettingsManagement />
      default:
        return <PlacesManagement />
    }
  }

  return (
    <AdminLayout
      currentMenu={currentMenu}
      onMenuChange={setCurrentMenu}
      onLogout={handleLogout}
    >
      {renderContent()}
    </AdminLayout>
  )
}

export default AdminDashboard
