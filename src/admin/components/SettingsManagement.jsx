import { useState, useEffect } from 'react'
import { changeAdminPassword, getCommonCodes } from '../../lib/admin'

const SettingsManagement = () => {
  const [activeTab, setActiveTab] = useState('password')
  const [categories, setCategories] = useState([])

  useEffect(() => {
    if (activeTab === 'codes') {
      loadCategories()
    }
  }, [activeTab])

  const loadCategories = async () => {
    const data = await getCommonCodes('place_category')
    setCategories(data)
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">설정</h2>

      <div className="flex gap-4 mb-6 border-b border-gray-800">
        <button
          onClick={() => setActiveTab('password')}
          className={`px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'password'
              ? 'border-[#ADFF2F] text-[#ADFF2F]'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          비밀번호 변경
        </button>
        <button
          onClick={() => setActiveTab('codes')}
          className={`px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'codes'
              ? 'border-[#ADFF2F] text-[#ADFF2F]'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          공통코드 관리
        </button>
      </div>

      {activeTab === 'password' && <PasswordChangeForm />}
      {activeTab === 'codes' && <CommonCodesManagement categories={categories} onReload={loadCategories} />}
    </div>
  )
}

const PasswordChangeForm = () => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.')
      return
    }

    if (newPassword.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.')
      return
    }

    setIsLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const result = await changeAdminPassword(token, currentPassword, newPassword)

      if (result.success) {
        setSuccess('비밀번호가 변경되었습니다.')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setError(result.error || '비밀번호 변경에 실패했습니다.')
      }
    } catch (err) {
      setError('오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 max-w-md">
      <h3 className="text-lg font-semibold mb-4">비밀번호 변경</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">현재 비밀번호</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">새 비밀번호</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">새 비밀번호 확인</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
          />
        </div>
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-500/20 border border-green-500 rounded-lg text-green-400 text-sm">
            {success}
          </div>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 bg-[#ADFF2F] text-black font-semibold rounded-lg hover:bg-[#ADFF2F]/90 transition-colors disabled:opacity-50"
        >
          {isLoading ? '변경 중...' : '비밀번호 변경'}
        </button>
      </form>
    </div>
  )
}

const CommonCodesManagement = ({ categories, onReload }) => {
  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">장소 카테고리 관리</h3>
        <button
          className="px-4 py-2 bg-[#ADFF2F] text-black rounded-lg hover:bg-[#ADFF2F]/90 transition-colors text-sm font-semibold"
          onClick={() => {
            alert('카테고리 추가 기능은 다음 단계에서 구현됩니다.')
          }}
        >
          + 카테고리 추가
        </button>
      </div>
      <div className="space-y-2">
        {categories.map((category) => (
          <div
            key={category.id}
            className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
          >
            <div>
              <p className="font-medium">{category.code_label_ko}</p>
              <p className="text-sm text-gray-400">{category.code_value}</p>
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                onClick={() => {
                  alert('수정 기능은 다음 단계에서 구현됩니다.')
                }}
              >
                수정
              </button>
              <button
                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm"
                onClick={() => {
                  alert('삭제 기능은 다음 단계에서 구현됩니다.')
                }}
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SettingsManagement
