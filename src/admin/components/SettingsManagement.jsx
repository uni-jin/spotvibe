import { useState, useEffect } from 'react'
import { changeAdminPassword, getCommonCodes, saveCommonCode, deleteCommonCode } from '../../lib/admin'

const CODE_TYPE_OPTIONS = [
  { value: 'place_category', label: '장소 카테고리' },
  { value: 'tags', label: '태그' },
]

const TAG_GROUP_CONFIG = [
  { key: 'admission', codeType: 'place_tag_admission', label: '입장/예약' },
  { key: 'benefit', codeType: 'place_tag_benefit', label: '혜택' },
  { key: 'amenity', codeType: 'place_tag_amenity', label: '편의' },
  { key: 'content', codeType: 'place_tag_content', label: '콘텐츠' },
]

const PLACE_TAG_TYPES = ['place_tag_admission', 'place_tag_benefit', 'place_tag_amenity', 'place_tag_content']

const SettingsManagement = () => {
  const [activeTab, setActiveTab] = useState('codes')
  const [codes, setCodes] = useState([])
  const [selectedCodeType, setSelectedCodeType] = useState('place_category')
  const [tagCodesByGroup, setTagCodesByGroup] = useState({
    admission: [],
    benefit: [],
    amenity: [],
    content: [],
  })

  useEffect(() => {
    if (activeTab === 'codes') {
      if (selectedCodeType === 'place_category') {
        loadCodes('place_category')
      } else if (selectedCodeType === 'tags') {
        loadAllTagCodes()
      }
    }
  }, [activeTab, selectedCodeType])

  const loadCodes = async (codeType) => {
    const data = await getCommonCodes(codeType, true)
    setCodes(data)
  }

  const loadAllTagCodes = async () => {
    const [admission, benefit, amenity, content] = await Promise.all([
      getCommonCodes('place_tag_admission', true),
      getCommonCodes('place_tag_benefit', true),
      getCommonCodes('place_tag_amenity', true),
      getCommonCodes('place_tag_content', true),
    ])
    setTagCodesByGroup({
      admission: admission || [],
      benefit: benefit || [],
      amenity: amenity || [],
      content: content || [],
    })
  }

  const handleReloadCodes = () => {
    if (selectedCodeType === 'place_category') loadCodes('place_category')
    else loadAllTagCodes()
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">설정</h2>

      <div className="flex gap-4 mb-6 border-b border-gray-800">
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
      </div>

      {activeTab === 'codes' && (
        <>
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-400 mb-2">코드 종류</p>
            <div className="flex flex-wrap gap-1 border-b border-gray-800">
              {CODE_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedCodeType(opt.value)}
                  className={`px-3 py-2 text-sm border-b-2 transition-colors -mb-px ${
                    selectedCodeType === opt.value
                      ? 'border-[#ADFF2F] text-[#ADFF2F]'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {selectedCodeType === 'place_category' && (
            <CommonCodesManagement
              codes={codes}
              codeType="place_category"
              onReload={handleReloadCodes}
            />
          )}
          {selectedCodeType === 'tags' && (
            <TagGroupsManagement
              tagCodesByGroup={tagCodesByGroup}
              onReload={handleReloadCodes}
            />
          )}
        </>
      )}
      {activeTab === 'password' && <PasswordChangeForm />}
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

const TagGroupsManagement = ({ tagCodesByGroup, onReload }) => {
  const [showForm, setShowForm] = useState(false)
  const [editingCode, setEditingCode] = useState(null)
  const [addCodeType, setAddCodeType] = useState(null)

  const handleAddNew = (codeType) => {
    setEditingCode(null)
    setAddCodeType(codeType)
    setShowForm(true)
  }

  const handleEdit = (code) => {
    setEditingCode(code)
    setAddCodeType(null)
    setShowForm(true)
  }

  const handleDeleteClick = (code) => {
    const firstMsg = `"${code.code_label}" 태그를 삭제하시겠습니까?\n\n이 태그를 사용 중인 장소가 있을 수 있습니다. 삭제하면 해당 태그가 공통코드에서 제거되며, 사용자 화면에도 더 이상 표시되지 않습니다.`
    if (window.confirm(firstMsg)) {
      if (window.confirm('정말 삭제하시겠습니까?')) {
        doDelete(code)
      }
    }
  }

  const doDelete = async (code) => {
    const result = await deleteCommonCode(code.id)
    if (result.success) onReload()
    else alert(result.error || '삭제에 실패했습니다.')
  }

  const handleToggleActive = async (code) => {
    const result = await saveCommonCode({ ...code, is_active: !code.is_active }, code.id)
    if (result.success) onReload()
    else alert(result.error || '상태 변경에 실패했습니다.')
  }

  const formCodeType = editingCode ? editingCode.code_type : addCodeType

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">태그 관리</h3>

      {showForm && formCodeType ? (
        <CommonCodeForm
          code={editingCode}
          codeType={formCodeType}
          onClose={() => {
            setShowForm(false)
            setEditingCode(null)
            setAddCodeType(null)
          }}
          onSuccess={() => {
            setShowForm(false)
            setEditingCode(null)
            setAddCodeType(null)
            onReload()
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TAG_GROUP_CONFIG.map((group) => (
            <div key={group.key} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-[#ADFF2F]">{group.label}</h4>
                <button
                  type="button"
                  onClick={() => handleAddNew(group.codeType)}
                  className="px-2 py-1 bg-[#ADFF2F]/20 hover:bg-[#ADFF2F]/30 text-[#ADFF2F] rounded text-xs font-medium"
                >
                  + 추가
                </button>
              </div>
              <div className="space-y-2 min-h-[80px]">
                {(tagCodesByGroup[group.key] || []).length === 0 ? (
                  <p className="text-xs text-gray-500 py-2">등록된 태그가 없습니다.</p>
                ) : (
                  (tagCodesByGroup[group.key] || []).map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-2 rounded text-sm ${
                        item.is_active ? 'bg-gray-700/50' : 'bg-gray-700/30 opacity-60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{item.code_label}</p>
                        <p className="text-xs text-gray-500 truncate">{item.code_value}</p>
                        {!item.is_active && (
                          <span className="text-[10px] text-gray-400">비활성</span>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0 ml-1">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(item)}
                          className="px-1.5 py-0.5 bg-gray-600 hover:bg-gray-500 rounded text-[10px]"
                          title={item.is_active ? '비활성화' : '활성화'}
                        >
                          {item.is_active ? '숨김' : '표시'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="px-1.5 py-0.5 bg-gray-600 hover:bg-gray-500 rounded text-[10px]"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(item)}
                          className="px-1.5 py-0.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-[10px]"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const CommonCodesManagement = ({ codes, codeType, onReload }) => {
  const [showForm, setShowForm] = useState(false)
  const [editingCode, setEditingCode] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [codeToDelete, setCodeToDelete] = useState(null)
  const isPlaceTag = PLACE_TAG_TYPES.includes(codeType)

  const handleAddNew = () => {
    setEditingCode(null)
    setShowForm(true)
  }

  const handleEdit = (code) => {
    setEditingCode(code)
    setShowForm(true)
  }

  const handleDeleteClick = (code) => {
    const firstMsg = isPlaceTag
      ? `"${code.code_label}" 태그를 삭제하시겠습니까?\n\n이 태그를 사용 중인 장소가 있을 수 있습니다. 삭제하면 해당 태그가 공통코드에서 제거되며, 사용자 화면에도 더 이상 표시되지 않습니다.`
      : `"${code.code_label}" 카테고리를 삭제하시겠습니까?`
    if (window.confirm(firstMsg)) {
      if (isPlaceTag) {
        const secondMsg = '정말 삭제하시겠습니까?'
        if (window.confirm(secondMsg)) {
          doDelete(code)
        }
      } else {
        doDelete(code)
      }
    }
  }

  const doDelete = async (code) => {
    const result = await deleteCommonCode(code.id)
    if (result.success) {
      onReload()
    } else {
      alert(result.error || '삭제에 실패했습니다.')
    }
  }

  const handleDelete = handleDeleteClick

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
        <h3 className="text-lg font-semibold">
          {CODE_TYPE_OPTIONS.find(o => o.value === codeType)?.label || '공통코드'} 관리
        </h3>
        <button
          className="px-4 py-2 bg-[#ADFF2F] text-black rounded-lg hover:bg-[#ADFF2F]/90 transition-colors text-sm font-semibold"
          onClick={handleAddNew}
        >
          + {isPlaceTag ? '태그' : '카테고리'} 추가
        </button>
      </div>

      {showForm ? (
        <CommonCodeForm
          code={editingCode}
          codeType={codeType}
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
          {codes.length > 0 ? (
            codes.map((category) => (
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
            <p className="text-gray-400 text-center py-8">등록된 항목이 없습니다.</p>
          )}
        </div>
      )}
    </div>
  )
}

const CommonCodeForm = ({ code, codeType, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    code_type: codeType || code?.code_type || 'place_category',
    code_value: code?.code_value || '',
    code_label: code?.code_label || '',
    display_order: code?.display_order ?? 0,
    is_active: code?.is_active !== undefined ? code.is_active : true,
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const isPlaceTag = PLACE_TAG_TYPES.includes(formData.code_type)

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.code_value.trim()) {
      setError('코드 값(code_value)을 입력해주세요.')
      return
    }

    if (!formData.code_label.trim()) {
      setError('코드명을 입력해주세요.')
      return
    }

    if (code && isPlaceTag) {
      const confirmed = window.confirm(
        '태그명을 수정하면 이 태그를 사용 중인 모든 장소에 반영됩니다. 계속하시겠습니까?'
      )
      if (!confirmed) return
    }

    setIsSaving(true)

    try {
      const result = await saveCommonCode(formData, code?.id || null)

      if (!result.success) {
        throw new Error(result.error || '카테고리 저장에 실패했습니다.')
      }

      setSuccess(code ? '수정되었습니다.' : '등록되었습니다.')
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
        {code ? (isPlaceTag ? '태그 수정' : '카테고리 수정') : (isPlaceTag ? '태그 추가' : '카테고리 추가')}
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
            disabled={!!code}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white disabled:opacity-50"
            placeholder={isPlaceTag ? '예: reservation_required' : '예: popup_store'}
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
          <p className="text-xs text-gray-500 mt-1">코드명이 사용자 화면에 표시됩니다.</p>
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
