import { useState, useEffect } from 'react'
import { getCustomPlaceNames, promoteCustomPlace, getCommonCodes } from '../../lib/admin'
import { db } from '../../lib/supabase'
import imageCompression from 'browser-image-compression'

const CustomPlacesManagement = () => {
  const [customPlaces, setCustomPlaces] = useState([])
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showPromoteForm, setShowPromoteForm] = useState(false)
  const [placeToPromote, setPlaceToPromote] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    await Promise.all([loadCustomPlaces(), loadCategories()])
  }

  const loadCategories = async () => {
    const data = await getCommonCodes('place_category')
    setCategories(data)
  }

  const loadCustomPlaces = async () => {
    try {
      setIsLoading(true)
      const data = await getCustomPlaceNames()
      setCustomPlaces(data)
    } catch (error) {
      console.error('Error loading custom places:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ADFF2F] mx-auto mb-4"></div>
        <p className="text-gray-400">로딩 중...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">기타 장소 관리</h2>
          <p className="text-sm text-gray-400 mt-1">
            사용자들이 "기타"로 입력한 장소명 목록
          </p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">장소명</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">카테고리</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">사용 횟수</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">최근 사용</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {customPlaces.length > 0 ? (
              customPlaces.map((place) => (
                <tr key={place.id} className="hover:bg-gray-800/50">
                  <td className="px-6 py-4 font-medium">{place.place_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">{place.category_type || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">{place.usage_count}회</td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {place.last_used_at
                      ? new Date(place.last_used_at).toLocaleDateString('ko-KR')
                      : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      className="px-3 py-1 bg-[#ADFF2F] text-black rounded text-sm font-semibold hover:bg-[#ADFF2F]/90"
                      onClick={() => {
                        setPlaceToPromote(place)
                        setShowPromoteForm(true)
                      }}
                    >
                      공식 장소로 승격
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                  기타 장소가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showPromoteForm && (
        <PromotePlaceForm
          customPlace={placeToPromote}
          categories={categories}
          onClose={() => {
            setShowPromoteForm(false)
            setPlaceToPromote(null)
          }}
          onSuccess={() => {
            setShowPromoteForm(false)
            setPlaceToPromote(null)
            loadCustomPlaces()
          }}
        />
      )}
    </div>
  )
}

const PromotePlaceForm = ({ customPlace, categories, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: customPlace?.place_name || '',
    name_en: '',
    type: customPlace?.category_type || '',
    description: '',
    lat: '',
    lng: '',
  })
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [thumbnailPreview, setThumbnailPreview] = useState(null)
  const [isPromoting, setIsPromoting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다.')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setThumbnailPreview(reader.result)
    }
    reader.readAsDataURL(file)

    setThumbnailFile(file)
    setError('')
  }

  const compressImage = async (file) => {
    const options = {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.85,
    }

    try {
      return await imageCompression(file, options)
    } catch (error) {
      console.error('Error compressing image:', error)
      return file
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.name.trim()) {
      setError('장소명을 입력해주세요.')
      return
    }

    if (!formData.type) {
      setError('카테고리를 선택해주세요.')
      return
    }

    setIsPromoting(true)

    try {
      let thumbnailUrl = null

      // Upload thumbnail if provided
      if (thumbnailFile) {
        const compressedFile = await compressImage(thumbnailFile)
        const timestamp = Date.now()
        const fileExtension = compressedFile.name.split('.').pop() || 'jpg'
        const thumbnailPath = `places/${timestamp}_${formData.name.replace(/\s+/g, '_')}.${fileExtension}`

        const { data: uploadData, error: uploadError } = await db.uploadImage(compressedFile, thumbnailPath)

        if (uploadError) {
          throw new Error('대표사진 업로드에 실패했습니다.')
        }

        thumbnailUrl = uploadData.publicUrl
      }

      // Promote custom place
      const result = await promoteCustomPlace(customPlace.id, {
        ...formData,
        thumbnail_url: thumbnailUrl,
      })

      if (!result.success) {
        throw new Error(result.error || '장소 승격에 실패했습니다.')
      }

      setSuccess('장소가 공식 장소로 승격되었습니다.')
      setTimeout(() => {
        onSuccess()
      }, 1000)
    } catch (err) {
      console.error('Error promoting place:', err)
      setError(err.message || '장소 승격에 실패했습니다.')
    } finally {
      setIsPromoting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">공식 장소로 승격</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-400 mb-1">승격할 장소명</p>
            <p className="font-medium">{customPlace?.place_name}</p>
            <p className="text-xs text-gray-500 mt-2">
              사용 횟수: {customPlace?.usage_count}회
            </p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              카테고리 <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.type}
              onChange={(e) => handleInputChange('type', e.target.value)}
              required
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
            >
              <option value="">카테고리 선택</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.code_value}>
                  {cat.code_label_ko}
                </option>
              ))}
            </select>
          </div>

          {/* Name (Korean) */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              장소명 (한글) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
            />
          </div>

          {/* Name (English) */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              장소명 (영문) <span className="text-gray-500 text-xs">(선택)</span>
            </label>
            <input
              type="text"
              value={formData.name_en}
              onChange={(e) => handleInputChange('name_en', e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
            />
          </div>

          {/* Thumbnail */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              대표사진 <span className="text-gray-500 text-xs">(선택)</span>
            </label>
            {thumbnailPreview && (
              <div className="mb-4">
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail preview"
                  className="w-32 h-32 object-cover rounded-lg border border-gray-700"
                />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#ADFF2F] file:text-black hover:file:bg-[#ADFF2F]/90"
            />
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                위도 (Latitude) <span className="text-gray-500 text-xs">(선택)</span>
              </label>
              <input
                type="number"
                step="any"
                value={formData.lat}
                onChange={(e) => handleInputChange('lat', e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
                placeholder="37.5432"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                경도 (Longitude) <span className="text-gray-500 text-xs">(선택)</span>
              </label>
              <input
                type="number"
                step="any"
                value={formData.lng}
                onChange={(e) => handleInputChange('lng', e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
                placeholder="127.0543"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              설명 <span className="text-gray-500 text-xs">(선택)</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={4}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white resize-none"
              placeholder="장소에 대한 설명을 입력하세요..."
            />
          </div>

          {/* Error/Success Messages */}
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

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
              disabled={isPromoting}
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-[#ADFF2F] hover:bg-[#ADFF2F]/90 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isPromoting}
            >
              {isPromoting ? '승격 중...' : '승격'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CustomPlacesManagement
