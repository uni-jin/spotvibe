import { useState, useEffect } from 'react'
import { getAdminPlaces, getCommonCodes } from '../../lib/admin'

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
        place.name?.toLowerCase().includes(searchName.toLowerCase()) ||
        place.name_en?.toLowerCase().includes(searchName.toLowerCase())
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
                            <div>
                              <p className="font-medium">{place.name}</p>
                              {place.name_en && (
                                <p className="text-sm text-gray-400">{place.name_en}</p>
                              )}
                            </div>
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

// PlaceForm component will be implemented separately
const PlaceForm = ({ place, categories, onClose, onSuccess }) => {
  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <h3 className="text-xl font-bold mb-4">
        {place ? '장소 수정' : '장소 등록'}
      </h3>
      <p className="text-gray-400 mb-4">장소 등록 폼은 다음 단계에서 구현됩니다.</p>
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg"
        >
          취소
        </button>
      </div>
    </div>
  )
}

export default PlacesManagement
