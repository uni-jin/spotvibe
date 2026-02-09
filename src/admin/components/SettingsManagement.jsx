import { useState, useEffect } from 'react'
import { changeAdminPassword, getCommonCodes, saveCommonCode, deleteCommonCode } from '../../lib/admin'

const SettingsManagement = () => {
  const [activeTab, setActiveTab] = useState('password')
  const [categories, setCategories] = useState([])

  useEffect(() => {
    if (activeTab === 'codes') {
      loadCategories()
    }
  }, [activeTab])

  const loadCategories = async () => {
    const data = await getCommonCodes('place_category', true) // Include inactive for admin
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
  const [showForm, setShowForm] = useState(false)
  const [editingCode, setEditingCode] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [codeToDelete, setCodeToDelete] = useState(null)

  const handleAddNew = () => {
    setEditingCode(null)
    setShowForm(true)
  }

  const handleEdit = (code) => {
    setEditingCode(code)
    setShowForm(true)
  }

  const handleDelete = async (code) => {
    if (window.confirm(`"${code.code_label}" 카테고리를 삭제하시겠습니까?`)) {
      const result = await deleteCommonCode(code.id)
      if (result.success) {
        onReload()
      } else {
        alert(result.error || '삭제에 실패했습니다.')
      }
    }
  }

  const handleToggleActive = async (code) => {
    const result = await saveCommonCode(
      {
        ...code,
        is_active: !code.is_active
      },
      code.id
    )
    if (result.success) {
      onReload()
    } else {
      alert(result.error || '상태 변경에 실패했습니다.')
    }
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">장소 카테고리 관리</h3>
        <button
          className="px-4 py-2 bg-[#ADFF2F] text-black rounded-lg hover:bg-[#ADFF2F]/90 transition-colors text-sm font-semibold"
          onClick={handleAddNew}
        >
          + 카테고리 추가
        </button>
      </div>

      {showForm ? (
        <CommonCodeForm
          code={editingCode}
          onClose={() => {
            setShowForm(false)
            setEditingCode(null)
          }}
          onSuccess={() => {
            setShowForm(false)
            setEditingCode(null)
            onReload()
          }}
        />
      ) : (
        <div className="space-y-2">
          {categories.length > 0 ? (
            categories.map((category) => (
              <div
                key={category.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  category.is_active ? 'bg-gray-800' : 'bg-gray-800/50 opacity-60'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{category.code_label}</p>
                    {!category.is_active && (
                      <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                        비활성
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">{category.code_value}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    순서: {category.display_order}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                    onClick={() => handleToggleActive(category)}
                  >
                    {category.is_active ? '비활성화' : '활성화'}
                  </button>
                  <button
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                    onClick={() => handleEdit(category)}
                  >
                    수정
                  </button>
                  <button
                    className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm"
                    onClick={() => handleDelete(category)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-center py-8">등록된 카테고리가 없습니다.</p>
          )}
        </div>
      )}
    </div>
  )
}

const CommonCodeForm = ({ code, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    code_type: 'place_category',
    code_value: code?.code_value || '',
    code_label: code?.code_label || '',
    display_order: code?.display_order || 0,
    is_active: code?.is_active !== undefined ? code.is_active : true,
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validation
    if (!formData.code_value.trim()) {
      setError('코드 값(code_value)을 입력해주세요.')
      return
    }

    if (!formData.code_label.trim()) {
      setError('코드명을 입력해주세요.')
      return
    }

    setIsSaving(true)

    try {
      const result = await saveCommonCode(formData, code?.id || null)

      if (!result.success) {
        throw new Error(result.error || '카테고리 저장에 실패했습니다.')
      }

      setSuccess(code ? '카테고리가 수정되었습니다.' : '카테고리가 등록되었습니다.')
      setTimeout(() => {
        onSuccess()
      }, 1000)
    } catch (err) {
      console.error('Error saving common code:', err)
      setError(err.message || '카테고리 저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h4 className="text-lg font-semibold mb-4">
        {code ? '카테고리 수정' : '카테고리 추가'}
      </h4>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">
            코드 값 (code_value) <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.code_value}
            onChange={(e) => handleInputChange('code_value', e.target.value)}
            required
            disabled={!!code} // 수정 시 코드 값 변경 불가
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white disabled:opacity-50"
            placeholder="예: popup_store"
          />
          {code && (
            <p className="text-xs text-gray-500 mt-1">코드 값은 수정할 수 없습니다.</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">
            코드명 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.code_label}
            onChange={(e) => handleInputChange('code_label', e.target.value)}
            required
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
            placeholder="예: Pop-up Store"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">
            표시 순서
          </label>
          <input
            type="number"
            value={formData.display_order}
            onChange={(e) => handleInputChange('display_order', parseInt(e.target.value) || 0)}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
            placeholder="0"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => handleInputChange('is_active', e.target.checked)}
              className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-[#ADFF2F] focus:ring-[#ADFF2F]"
            />
            <span className="text-sm text-gray-300">활성화</span>
          </label>
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

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
            disabled={isSaving}
          >
            취소
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-[#ADFF2F] hover:bg-[#ADFF2F]/90 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSaving}
          >
            {isSaving ? '저장 중...' : code ? '수정' : '등록'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default SettingsManagement
