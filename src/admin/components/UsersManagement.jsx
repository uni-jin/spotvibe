import { useMemo, useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

function userDisplayName(profile) {
  const name = (profile?.full_name || '').trim()
  if (name) return name
  const email = (profile?.email || '').trim()
  if (!email) return '이름 없음'
  return email.split('@')[0] || '이름 없음'
}

const UsersManagement = () => {
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const formatDateTime = (ts) => {
    if (!ts) return '-'
    try {
      return new Date(ts).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return '-'
    }
  }

  const loadUsers = async () => {
    try {
      setIsLoading(true)
      // 1) profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (profilesError) throw profilesError
      const ids = (profiles || []).map((p) => p.id).filter(Boolean)
      if (ids.length === 0) {
        setUsers([])
        return
      }

      // 2) picks + comments (batch) -> count + last activity time
      const [picksRes, commentsRes] = await Promise.all([
        supabase
          .from('user_place_picks')
          .select('user_id, created_at')
          .in('user_id', ids),
        supabase
          .from('place_comments')
          .select('user_id, created_at')
          .in('user_id', ids),
      ])

      if (picksRes.error) throw picksRes.error
      if (commentsRes.error) throw commentsRes.error

      const pickCountByUser = {}
      const lastPickAtByUser = {}
      ;(picksRes.data || []).forEach((r) => {
        if (!r.user_id) return
        pickCountByUser[r.user_id] = (pickCountByUser[r.user_id] || 0) + 1
        const t = r.created_at ? new Date(r.created_at).getTime() : 0
        if (!lastPickAtByUser[r.user_id] || t > lastPickAtByUser[r.user_id]) {
          lastPickAtByUser[r.user_id] = t
        }
      })

      const commentCountByUser = {}
      const lastCommentAtByUser = {}
      ;(commentsRes.data || []).forEach((r) => {
        if (!r.user_id) return
        commentCountByUser[r.user_id] = (commentCountByUser[r.user_id] || 0) + 1
        const t = r.created_at ? new Date(r.created_at).getTime() : 0
        if (!lastCommentAtByUser[r.user_id] || t > lastCommentAtByUser[r.user_id]) {
          lastCommentAtByUser[r.user_id] = t
        }
      })

      const usersWithStats = (profiles || []).map((profile) => ({
        ...profile,
        pickCount: pickCountByUser[profile.id] || 0,
        commentCount: commentCountByUser[profile.id] || 0,
        lastPickAt: lastPickAtByUser[profile.id] ? new Date(lastPickAtByUser[profile.id]).toISOString() : null,
        lastCommentAt: lastCommentAtByUser[profile.id] ? new Date(lastCommentAtByUser[profile.id]).toISOString() : null,
      }))

      setUsers(usersWithStats)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterUsers = useCallback(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = users.filter(user =>
      userDisplayName(user).toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    )
    setFilteredUsers(filtered)
  }, [users, searchQuery])

  useEffect(() => {
    filterUsers()
  }, [filterUsers])

  const loadUserDetails = async (userId) => {
    try {
      const user = users.find(u => u.id === userId)
      if (!user) return

      // Totals + last activity
      const [pickCountRes, commentCountRes, lastPickRes, lastCommentRes, recentPicksRes, recentCommentsRes] = await Promise.all([
        supabase.from('user_place_picks').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('place_comments').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('user_place_picks').select('created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
        supabase.from('place_comments').select('created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
        supabase.from('user_place_picks').select('place_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
        supabase.from('place_comments').select('id, place_id, content, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      ])

      if (pickCountRes.error) throw pickCountRes.error
      if (commentCountRes.error) throw commentCountRes.error
      if (lastPickRes.error) throw lastPickRes.error
      if (lastCommentRes.error) throw lastCommentRes.error
      if (recentPicksRes.error) throw recentPicksRes.error
      if (recentCommentsRes.error) throw recentCommentsRes.error

      const recentPickPlaceIds = [...new Set((recentPicksRes.data || []).map((r) => r.place_id).filter(Boolean))]
      const recentCommentPlaceIds = [...new Set((recentCommentsRes.data || []).map((r) => r.place_id).filter(Boolean))]
      const placeIds = [...new Set([...recentPickPlaceIds, ...recentCommentPlaceIds])]

      let placesById = {}
      if (placeIds.length > 0) {
        const { data: places, error: placesError } = await supabase
          .from('places')
          .select('id, name, name_en, thumbnail_url, type')
          .in('id', placeIds)
        if (placesError) throw placesError
        placesById = (places || []).reduce((acc, p) => {
          acc[p.id] = p
          return acc
        }, {})
      }

      setSelectedUser({
        ...user,
        pickCount: pickCountRes.count || 0,
        commentCount: commentCountRes.count || 0,
        lastPickAt: (lastPickRes.data && lastPickRes.data[0]?.created_at) || null,
        lastCommentAt: (lastCommentRes.data && lastCommentRes.data[0]?.created_at) || null,
        recentPicks: (recentPicksRes.data || []).map((r) => ({
          ...r,
          place: r.place_id ? placesById[r.place_id] : null,
        })),
        recentComments: (recentCommentsRes.data || []).map((r) => ({
          ...r,
          place: r.place_id ? placesById[r.place_id] : null,
        })),
      })
    } catch (error) {
      console.error('Error loading user details:', error)
    }
  }

  const selectedUserTitle = useMemo(() => {
    if (!selectedUser) return ''
    return userDisplayName(selectedUser) || selectedUser.email
  }, [selectedUser])

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ADFF2F] mx-auto mb-4"></div>
        <p className="text-gray-400">로딩 중...</p>
      </div>
    )
  }

  if (selectedUser) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => setSelectedUser(null)}
              className="text-gray-400 hover:text-white mb-2"
            >
              ← 목록으로
            </button>
            <h2 className="text-2xl font-bold">{selectedUserTitle}</h2>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">기본 정보</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">이메일</p>
              <p className="text-white">{selectedUser.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">가입일</p>
              <p className="text-white">
                {new Date(selectedUser.created_at).toLocaleDateString('ko-KR')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">픽 수</p>
              <p className="text-white">{selectedUser.pickCount || 0}개</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">댓글 수</p>
              <p className="text-white">{selectedUser.commentCount || 0}개</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">마지막 픽</p>
              <p className="text-white">{formatDateTime(selectedUser.lastPickAt)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">마지막 댓글</p>
              <p className="text-white">{formatDateTime(selectedUser.lastCommentAt)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-900 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">최근 픽한 장소 (10)</h3>
            {selectedUser.recentPicks && selectedUser.recentPicks.length > 0 ? (
              <div className="space-y-3">
                {selectedUser.recentPicks.map((p, idx) => (
                  <div key={`${p.place_id}-${idx}`} className="flex items-center gap-3 bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                    {p.place?.thumbnail_url ? (
                      <img src={p.place.thumbnail_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                        -
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate">{p.place?.name || `place_id: ${p.place_id}`}</div>
                      <div className="text-xs text-gray-400">{formatDateTime(p.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">픽한 장소가 없습니다.</p>
            )}
          </div>

          <div className="bg-gray-900 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">최근 댓글 (10)</h3>
            {selectedUser.recentComments && selectedUser.recentComments.length > 0 ? (
              <div className="space-y-3">
                {selectedUser.recentComments.map((c) => (
                  <div key={c.id} className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="font-semibold text-sm truncate">
                        {c.place?.name || `place_id: ${c.place_id}`}
                      </div>
                      <div className="text-xs text-gray-400 flex-shrink-0">{formatDateTime(c.created_at)}</div>
                    </div>
                    <div className="text-sm text-gray-200 whitespace-pre-line break-words">
                      {c.content}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">댓글이 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">회원관리</h2>
      </div>

      {/* Search Filter */}
      <div className="bg-gray-900 rounded-lg p-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2 text-gray-300">검색</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름 또는 이메일로 검색..."
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
            >
              초기화
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">사용자</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">가입일</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">픽</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">댓글</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">마지막 픽</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">마지막 댓글</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-800/50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-700 flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                        {(userDisplayName(user).charAt(0) || '?').toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{userDisplayName(user)}</p>
                      <p className="text-sm text-gray-400 truncate">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-300">
                  {new Date(user.created_at).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-6 py-4 text-sm text-gray-300">{user.pickCount || 0}개</td>
                <td className="px-6 py-4 text-sm text-gray-300">{user.commentCount || 0}개</td>
                <td className="px-6 py-4 text-sm text-gray-300">{formatDateTime(user.lastPickAt)}</td>
                <td className="px-6 py-4 text-sm text-gray-300">{formatDateTime(user.lastCommentAt)}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => loadUserDetails(user.id)}
                    className="px-4 py-2 bg-[#ADFF2F] text-black rounded-lg hover:bg-[#ADFF2F]/90 transition-colors text-sm font-semibold"
                  >
                    상세보기
                  </button>
                </td>
              </tr>
            ))
            ) : (
              <tr>
                <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                  {users.length === 0 ? '등록된 회원이 없습니다.' : '검색 결과가 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default UsersManagement
