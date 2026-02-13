import { createClient } from '@supabase/supabase-js'
import { getDisplayStatusFromPeriods } from './kstDateUtils.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth helper functions
export const auth = {
  // Sign in with Google
  async signInWithGoogle() {
    // 현재 URL에서 hash와 query 제거한 깨끗한 URL 사용
    const redirectTo = `${window.location.origin}${window.location.pathname}`
    
    console.log('Initiating Google OAuth with redirectTo:', redirectTo)
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    
    if (error) {
      console.error('OAuth sign-in error:', error)
    } else {
      console.log('OAuth sign-in initiated:', data)
    }
    
    return { data, error }
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Get current session
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession()
    return { session, error }
  },

  // Get current user
  getCurrentUser() {
    return supabase.auth.getUser()
  },

  // Listen to auth state changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
  },
}

// Database helper functions
export const db = {
  // Get all posts with images
  async getPosts(placeId = null) {
    let query = supabase
      .from('posts')
      .select(`
        *,
        post_images (
          id,
          image_url,
          is_main,
          captured_at,
          image_order
        )
      `)
      .order('created_at', { ascending: false })

    if (placeId) {
      query = query.eq('place_id', placeId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching posts:', error)
      return []
    }

    // Transform data to match current app structure
    return data.map((post) => ({
      id: post.id,
      placeId: post.place_id,
      placeName: post.place_name,
      vibe: post.vibe,
      category_type: post.category_type ?? 'other',
      description: post.description || null,
      image: post.main_image_url || (post.post_images?.find(img => img.is_main)?.image_url),
      images: post.post_images
        ?.sort((a, b) => {
          // Main image first, then by order
          if (a.is_main) return -1
          if (b.is_main) return 1
          return a.image_order - b.image_order
        })
        .map(img => img.image_url) || [],
      timestamp: new Date(post.created_at),
      user: post.user_id || 'anonymous',
      userId: post.user_id || null,
      metadata: {
        ...post.metadata,
        lat: post.metadata?.lat,
        lng: post.metadata?.lng,
        capturedAt: post.metadata?.capturedAt ? new Date(post.metadata.capturedAt) : new Date(post.created_at),
        locationName: post.metadata?.locationName,
        additionalMetadata: post.post_images
          ?.filter(img => !img.is_main)
          .map(img => ({
            capturedAt: img.captured_at ? new Date(img.captured_at) : null,
          })) || [],
      },
    }))
  },

  // Get all places (filtered by display period - KST, with display status)
  async getPlaces(regionId = null) {
    let query = supabase
      .from('places')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (regionId) {
      query = query.eq('region_id', regionId)
    }

    const { data: placesData, error } = await query

    if (error) {
      console.error('Error fetching places:', error)
      return []
    }

    if (!placesData || placesData.length === 0) return []

    const placeIds = placesData.map((p) => p.id)
    const { data: periodsRows } = await supabase
      .from('place_display_periods')
      .select('place_id, display_start_date, display_end_date, display_order')
      .in('place_id', placeIds)
      .order('display_order', { ascending: true })

    const periodsByPlace = {}
    if (periodsRows && periodsRows.length > 0) {
      periodsRows.forEach((row) => {
        if (!periodsByPlace[row.place_id]) periodsByPlace[row.place_id] = []
        periodsByPlace[row.place_id].push({
          display_start_date: row.display_start_date,
          display_end_date: row.display_end_date,
        })
      })
    }

    // 복수 노출기간 또는 단일 기간 기준 노출 상태
    const withStatus = placesData.map((place) => {
      const display_periods = periodsByPlace[place.id] || null
      const status = getDisplayStatusFromPeriods(
        display_periods,
        place.display_start_date,
        place.display_end_date
      )
      return { place, display_periods, displayStatus: status }
    })

    // Hot Spots Now에는 진행중/시작 예정(및 무제한)만 노출, 종료는 제외
    const filtered = withStatus.filter(
      (item) =>
        item.displayStatus === 'active' ||
        item.displayStatus === 'scheduled' ||
        item.displayStatus === 'unlimited'
    )

    return filtered.map(({ place, display_periods, displayStatus }) => ({
      id: place.id,
      name: place.name,
      nameEn: place.name_en,
      type: place.type,
      status: place.status,
      wait: place.wait_time,
      lat: place.lat,
      lng: place.lng,
      thumbnail_url: place.thumbnail_url,
      description: place.description,
      display_start_date: place.display_start_date,
      display_end_date: place.display_end_date,
      display_periods: display_periods || undefined,
      info_url: place.info_url,
      phone: place.phone,
      hashtags: place.hashtags || [],
      displayStatus,
    }))
  },

  // Create a new post
  async createPost(postData) {
    const { placeId, placeName, vibe, description, mainImageUrl, additionalImageUrls, metadata, userId, categoryType } = postData

    // Insert post (category_type: posts 테이블에 컬럼 필요)
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({
        place_id: placeId || null,
        place_name: placeName,
        vibe: vibe,
        description: description || null,
        user_id: userId || null,
        main_image_url: mainImageUrl,
        category_type: categoryType ?? 'other',
        metadata: {
          lat: metadata.lat,
          lng: metadata.lng,
          capturedAt: metadata.capturedAt?.toISOString(),
          locationName: metadata.locationName,
        },
      })
      .select()
      .single()

    if (postError) {
      console.error('Error creating post:', postError)
      throw postError
    }

    // Insert main image
    if (mainImageUrl) {
      await supabase
        .from('post_images')
        .insert({
          post_id: post.id,
          image_url: mainImageUrl,
          is_main: true,
          captured_at: metadata.capturedAt?.toISOString(),
          image_order: 0,
        })
    }

    // Insert additional images
    if (additionalImageUrls && additionalImageUrls.length > 0) {
      const additionalImages = additionalImageUrls.map((url, index) => ({
        post_id: post.id,
        image_url: url,
        is_main: false,
        captured_at: metadata.additionalMetadata?.[index]?.capturedAt?.toISOString() || null,
        image_order: index + 1,
      }))

      await supabase
        .from('post_images')
        .insert(additionalImages)
    }

    return post
  },

  // Upload image to Supabase Storage
  async uploadImage(file, path) {
    const { data, error } = await supabase.storage
      .from('post-images')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Error uploading image:', error)
      throw error
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('post-images')
      .getPublicUrl(data.path)

    return { 
      data: { 
        path: data.path,
        publicUrl: urlData.publicUrl
      }, 
      error: null 
    }
  },

  // Get user profile by ID
  async getUserProfile(userId) {
    if (!userId) return null
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching user profile:', error)
      return null
    }

    return data
  },

  // Get like count for a post
  async getPostLikeCount(postId) {
    const { count, error } = await supabase
      .from('post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId)

    if (error) {
      console.error('Error fetching like count:', error)
      return 0
    }

    return count || 0
  },

  // Check if user liked a post
  async isPostLikedByUser(postId, userId) {
    if (!userId) return false

    const { data, error } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking like status:', error)
      return false
    }

    return !!data
  },

  // Toggle like on a post
  async togglePostLike(postId, userId) {
    if (!userId) {
      throw new Error('User must be logged in to like posts')
    }

    // Check if already liked
    const isLiked = await this.isPostLikedByUser(postId, userId)

    if (isLiked) {
      // Unlike: delete the like
      const { error } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId)

      if (error) {
        console.error('Error unliking post:', error)
        throw error
      }

      return { liked: false }
    } else {
      // Like: insert the like
      const { error } = await supabase
        .from('post_likes')
        .insert({
          post_id: postId,
          user_id: userId,
        })

      if (error) {
        console.error('Error liking post:', error)
        throw error
      }

      return { liked: true }
    }
  },

  // Get all likes for multiple posts (for batch loading)
  async getPostLikes(postIds, userId = null) {
    if (!postIds || postIds.length === 0) return {}

    const { data, error } = await supabase
      .from('post_likes')
      .select('post_id, user_id')
      .in('post_id', postIds)

    if (error) {
      console.error('Error fetching post likes:', error)
      return {}
    }

    // Group by post_id and count likes
    const likeCounts = {}
    const userLikes = {}

    data.forEach((like) => {
      likeCounts[like.post_id] = (likeCounts[like.post_id] || 0) + 1
      if (userId && like.user_id === userId) {
        userLikes[like.post_id] = true
      }
    })

    return { likeCounts, userLikes }
  },

  // Delete a post
  async deletePost(postId, userId) {
    // 먼저 포스트가 해당 사용자의 것인지 확인
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single()

    if (fetchError) {
      console.error('Error fetching post:', fetchError)
      throw new Error('Post not found')
    }

    if (post.user_id !== userId) {
      throw new Error('You do not have permission to delete this post')
    }

    // 포스트 삭제 (CASCADE로 인해 post_images와 post_likes도 자동 삭제됨)
    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)

    if (deleteError) {
      console.error('Error deleting post:', deleteError)
      throw deleteError
    }

    return { success: true }
  },
}
