import { useState, useEffect } from 'react'
import { getCustomPlaceNames } from '../../lib/admin'

const CustomPlacesManagement = () => {
  const [customPlaces, setCustomPlaces] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadCustomPlaces()
  }, [])

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
                        // 공식 장소로 승격 기능은 다음 단계에서 구현
                        alert('공식 장소로 승격 기능은 다음 단계에서 구현됩니다.')
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
    </div>
  )
}

export default CustomPlacesManagement
