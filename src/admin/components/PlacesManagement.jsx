import { useState, useEffect, useRef } from 'react'
import { getAdminPlaces, getCommonCodes, savePlace, deletePlace } from '../../lib/admin'
import { db } from '../../lib/supabase'
import imageCompression from 'browser-image-compression'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const PlacesManagement = () => {
  const [places, setPlaces] = useState([])
  const [filteredPlaces, setFilteredPlaces] = useState([])
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPlace, setEditingPlace] = useState(null)
  
  // Search filters
  const [searchName, setSearchName] = useState('')
  const [searchCategory, setSearchCategory] = useState('')
  const [searchActive, setSearchActive] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    filterPlaces()
  }, [places, searchName, searchCategory, searchActive])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [placesData, categoriesData] = await Promise.all([
        getAdminPlaces(),
        getCommonCodes('place_category')
      ])
      setPlaces(placesData)
      setCategories(categoriesData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterPlaces = () => {
    let filtered = [...places]

    // Filter by name
    if (searchName) {
      filtered = filtered.filter(place =>
        place.name?.toLowerCase().includes(searchName.toLowerCase())
      )
    }

    // Filter by category
    if (searchCategory) {
      filtered = filtered.filter(place => place.type === searchCategory)
    }

    // Filter by active status
    if (searchActive !== '') {
      const isActive = searchActive === 'true'
      filtered = filtered.filter(place => place.is_active === isActive)
    }

    setFilteredPlaces(filtered)
  }

  const getVibeLabel = (vibe) => {
    const vibeMap = {
      'verybusy': '🔥 Very Busy',
      'busy': '⏱️ Busy',
      'nowait': '✅ No Wait',
      'quiet': '🟢 Quiet',
      'soldout': '❌ Sold Out'
    }
    return vibeMap[vibe] || vibe
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleAddNew = () => {
    setEditingPlace(null)
    setShowForm(true)
  }

  const handleEdit = (place) => {
    setEditingPlace(place)
    setShowForm(true)
  }

  const handleResetFilters = () => {
    setSearchName('')
    setSearchCategory('')
    setSearchActive('')
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
        <h2 className="text-2xl font-bold">장소관리</h2>
        <button
          onClick={handleAddNew}
          className="px-4 py-2 bg-[#ADFF2F] text-black rounded-lg hover:bg-[#ADFF2F]/90 transition-colors font-semibold"
        >
          + 장소 등록
        </button>
      </div>

      {showForm ? (
        <PlaceForm
          place={editingPlace}
          categories={categories}
          onClose={() => {
            setShowForm(false)
            setEditingPlace(null)
          }}
          onSuccess={() => {
            setShowForm(false)
            setEditingPlace(null)
            loadData()
          }}
        />
      ) : (
        <>
          {/* Search Filters */}
          <div className="bg-gray-900 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">장소명</label>
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="장소명 검색..."
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">카테고리</label>
                <select
                  value={searchCategory}
                  onChange={(e) => setSearchCategory(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
                >
                  <option value="">전체</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.code_value}>
                      {cat.code_label_ko}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">활성화 여부</label>
                <select
                  value={searchActive}
                  onChange={(e) => setSearchActive(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
                >
                  <option value="">전체</option>
                  <option value="true">활성</option>
                  <option value="false">비활성</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleResetFilters}
                  className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
                >
                  필터 초기화
                </button>
              </div>
            </div>
          </div>

          {/* Places Table */}
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">장소명</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">카테고리</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">최근 상태</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">포스팅 수</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">활성화</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">등록일</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredPlaces.length > 0 ? (
                    filteredPlaces.map((place) => {
                      const category = categories.find(c => c.code_value === place.type)
                      return (
                        <tr key={place.id} className="hover:bg-gray-800/50">
                          <td className="px-6 py-4">
                            <p className="font-medium">{place.name}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-300">
                            {category?.code_label_ko || place.type || '-'}
                          </td>
                          <td className="px-6 py-4">
                            {place.recentVibe ? (
                              <span className="text-sm text-[#ADFF2F]">
                                {getVibeLabel(place.recentVibe)}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-500">-</span>
                            )}
                            {place.recentPostTime && (
                              <p className="text-xs text-gray-500 mt-1">
                                {formatDate(place.recentPostTime)}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-300">
                            {place.postCount || 0}개
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                place.is_active
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-gray-500/20 text-gray-400'
                              }`}
                            >
                              {place.is_active ? '활성' : '비활성'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-300">
                            {formatDate(place.created_at)}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleEdit(place)}
                              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm"
                            >
                              수정
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                        {places.length === 0 ? '등록된 장소가 없습니다.' : '검색 결과가 없습니다.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// PlaceForm component
const PlaceForm = ({ place, categories, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: place?.name || '',
    type: place?.type || '',
    description: place?.description || '',
    lat: place?.lat || '',
    lng: place?.lng || '',
    is_active: place?.is_active !== undefined ? place.is_active : true,
  })
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [thumbnailPreview, setThumbnailPreview] = useState(place?.thumbnail_url || null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Map state
  const [markerPosition, setMarkerPosition] = useState(
    place?.lat && place?.lng ? [parseFloat(place.lat), parseFloat(place.lng)] : null
  )
  const [mapCenter, setMapCenter] = useState(
    place?.lat && place?.lng 
      ? [parseFloat(place.lat), parseFloat(place.lng)]
      : [37.5446, 127.0559] // 기본값: 성수동
  )

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // 위도/경도가 직접 입력되면 마커 위치도 업데이트
    if (field === 'lat' || field === 'lng') {
      const lat = field === 'lat' ? parseFloat(value) : parseFloat(formData.lat)
      const lng = field === 'lng' ? parseFloat(value) : parseFloat(formData.lng)
      
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        setMarkerPosition([lat, lng])
        setMapCenter([lat, lng])
      }
    }
  }

  // Leaflet 기본 아이콘 설정
  useEffect(() => {
    // Fix for Leaflet default icon issue
    if (typeof window !== 'undefined' && L && L.Icon && L.Icon.Default && L.Icon.Default.prototype) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })
    }
  }, [])

  // Map click handler component
  const MapClickHandler = () => {
    useMapEvents({
      click: (e) => {
        const { lat, lng } = e.latlng
        setMarkerPosition([lat, lng])
        handleInputChange('lat', lat.toString())
        handleInputChange('lng', lng.toString())
      },
    })
    return null
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다.')
      return
    }

    // Create preview
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

    // Validation
    if (!formData.name.trim()) {
      setError('장소명을 입력해주세요.')
      return
    }

    if (!formData.type) {
      setError('카테고리를 선택해주세요.')
      return
    }

    setIsUploading(true)

    try {
      let thumbnailUrl = place?.thumbnail_url || null

      // Upload thumbnail if new file selected
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

      // Save place (name_en은 null로 설정)
      const result = await savePlace(
        {
          ...formData,
          name_en: null, // 영문명 필드 제거
          thumbnail_url: thumbnailUrl,
        },
        place?.id || null
      )

      if (!result.success) {
        throw new Error(result.error || '장소 저장에 실패했습니다.')
      }

      setSuccess(place ? '장소가 수정되었습니다.' : '장소가 등록되었습니다.')
      setTimeout(() => {
        onSuccess()
      }, 1000)
    } catch (err) {
      console.error('Error saving place:', err)
      setError(err.message || '장소 저장에 실패했습니다.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <h3 className="text-xl font-bold mb-6">
        {place ? '장소 수정' : '장소 등록'}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-6">
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

        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">
            장소명 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            required
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
            placeholder="예: 디올 성수"
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
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">
            위치 설정 <span className="text-gray-500 text-xs">(선택)</span>
          </label>
          <p className="text-xs text-gray-400 mb-2">
            지도를 클릭하여 위치를 선택하거나, 아래 입력란에 직접 좌표를 입력할 수 있습니다.
          </p>
          
          {/* Map */}
          <div className="mb-4 rounded-lg overflow-hidden border border-gray-700" style={{ height: '400px', position: 'relative' }}>
            {typeof window !== 'undefined' && (
              <MapContainer
                key={`map-${mapCenter[0]}-${mapCenter[1]}`}
                center={mapCenter}
                zoom={markerPosition ? 16 : 13}
                style={{ height: '100%', width: '100%', zIndex: 1 }}
                className="dark-map"
                scrollWheelZoom={true}
                whenCreated={(mapInstance) => {
                  // 지도가 생성된 후 초기화 확인
                  setTimeout(() => {
                    mapInstance.invalidateSize()
                  }, 100)
                }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  className="dark-tiles"
                />
                <MapClickHandler />
                {markerPosition && (
                  <Marker
                    position={markerPosition}
                    draggable={true}
                    eventHandlers={{
                      dragend: (e) => {
                        const marker = e.target
                        const position = marker.getLatLng()
                        setMarkerPosition([position.lat, position.lng])
                        handleInputChange('lat', position.lat.toString())
                        handleInputChange('lng', position.lng.toString())
                      },
                    }}
                  />
                )}
              </MapContainer>
            )}
          </div>

          {/* Coordinate inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                위도 (Latitude)
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
                경도 (Longitude)
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

        {/* Active Status */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => handleInputChange('is_active', e.target.checked)}
              className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-[#ADFF2F] focus:ring-[#ADFF2F]"
            />
            <span className="text-sm text-gray-300">활성화</span>
          </label>
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
            disabled={isUploading}
          >
            취소
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-[#ADFF2F] hover:bg-[#ADFF2F]/90 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isUploading}
          >
            {isUploading ? '저장 중...' : place ? '수정' : '등록'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default PlacesManagement
