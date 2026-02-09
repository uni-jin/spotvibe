import { useState, useEffect } from 'react'
import { getAdminPlaces, getCommonCodes } from '../../lib/admin'

const PlacesManagement = () => {
  const [places, setPlaces] = useState([])
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPlace, setEditingPlace] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

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

  const handleAddNew = () => {
    setEditingPlace(null)
    setShowForm(true)
  }

  const handleEdit = (place) => {
    setEditingPlace(place)
    setShowForm(true)
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
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">장소명</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">카테고리</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">상태</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">활성화</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {places.map((place) => {
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
                      {category?.code_label_ko || place.type}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">{place.status || '-'}</td>
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
              })}
            </tbody>
          </table>
        </div>
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
