import { useState, useEffect } from 'react'
import { verifyAdminToken } from '../lib/admin'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

function formatTimeLabel(date, isKST) {
  const d = isKST ? new Date(date.getTime() + KST_OFFSET_MS) : date
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const h = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  const s = String(d.getUTCSeconds()).padStart(2, '0')
  return `${y}-${mo}-${day} ${h}:${min}:${s}`
}

const AdminLayout = ({ children, currentMenu, onMenuChange, onLogout }) => {
  const [admin, setAdmin] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tid = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tid)
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('admin_token')
      if (!token) {
        onLogout()
        return
      }

      const { valid, admin: adminData } = await verifyAdminToken(token)
      if (!valid || !adminData) {
        localStorage.removeItem('admin_token')
        onLogout()
        return
      }

      setAdmin(adminData)
      setIsLoading(false)
    }

    checkAuth()
  }, [onLogout])

  const menuItems = [
    { id: 'users', label: '회원관리', icon: '👥' },
    { id: 'places', label: '장소관리', icon: '📍' },
    { id: 'custom-places', label: '기타 장소 관리', icon: '📝' },
    { id: 'settings', label: '설정', icon: '⚙️' },
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ADFF2F] mx-auto mb-4"></div>
          <p className="text-gray-400">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold">
            SpotVibe <span className="text-[#ADFF2F]">Admin</span>
          </h1>
          {admin && (
            <p className="text-sm text-gray-400 mt-1">{admin.username}님</p>
          )}
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => onMenuChange(item.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                    currentMenu === item.id
                      ? 'bg-[#ADFF2F]/20 text-[#ADFF2F] border border-[#ADFF2F]/50'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-3">
          <div className="text-xs text-gray-500 space-y-1">
            <div className="font-medium text-gray-400">시간 (비교용)</div>
            <div>KST: {formatTimeLabel(now, true)}</div>
            <div>UTC: {formatTimeLabel(now, false)}</div>
            <div className="mt-1 text-gray-600">DB 저장: KST</div>
          </div>
          <button
            onClick={onLogout}
            className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="w-full px-6 py-6">
          {children}
        </div>
      </div>
    </div>
  )
}

export default AdminLayout
