import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const UsersManagement = () => {
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    filterUsers()
  }, [users, searchQuery])

  const loadUsers = async () => {
    try {
      setIsLoading(true)
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (profilesError) throw profilesError

      // Get post counts for each user
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('user_id')

      if (postsError) throw postsError

      // Count posts per user
      const postCounts = {}
      posts.forEach(post => {
        if (post.user_id) {
          postCounts[post.user_id] = (postCounts[post.user_id] || 0) + 1
        }
      })

      // Combine data
      const usersWithStats = profiles.map(profile => ({
        ...profile,
        postCount: postCounts[profile.id] || 0
      }))

      setUsers(usersWithStats)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterUsers = () => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = users.filter(user =>
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    )
    setFilteredUsers(filtered)
  }

  const loadUserDetails = async (userId) => {
    try {
      // Get user posts
      const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Get like counts
      const postIds = posts.map(p => p.id)
      const { data: likes, error: likesError } = await supabase
        .from('post_likes')
        .select('post_id')
        .in('post_id', postIds)

      if (likesError) throw likesError

      const likeCounts = {}
      likes.forEach(like => {
        likeCounts[like.post_id] = (likeCounts[like.post_id] || 0) + 1
      })

      const user = users.find(u => u.id === userId)
      setSelectedUser({
        ...user,
        posts: posts.map(post => ({
          ...post,
          likeCount: likeCounts[post.id] || 0
        }))
      })
    } catch (error) {
      console.error('Error loading user details:', error)
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
            <h2 className="text-2xl font-bold">{selectedUser.name || selectedUser.email}</h2>
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
              <p className="text-sm text-gray-400">포스팅 수</p>
              <p className="text-white">{selectedUser.postCount}개</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">총 좋아요 수</p>
              <p className="text-white">
                {selectedUser.posts?.reduce((sum, p) => sum + p.likeCount, 0) || 0}개
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">포스팅 목록</h3>
          {selectedUser.posts && selectedUser.posts.length > 0 ? (
            <div className="space-y-4">
              {selectedUser.posts.map((post) => (
                <div key={post.id} className="bg-gray-900 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{post.place_name}</p>
                      <p className="text-sm text-gray-400">
                        {new Date(post.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">좋아요</p>
                      <p className="text-white">{post.likeCount}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">포스팅이 없습니다.</p>
          )}
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
              <th className="px-6 py-3 text-left text-sm font-semibold">이름/이메일</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">가입일</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">포스팅 수</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-800/50">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium">{user.name || '이름 없음'}</p>
                    <p className="text-sm text-gray-400">{user.email}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-300">
                  {new Date(user.created_at).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-6 py-4 text-sm text-gray-300">{user.postCount}개</td>
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
                <td colSpan="4" className="px-6 py-8 text-center text-gray-400">
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
