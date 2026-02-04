import { createClient } from '@supabase/supabase-js'

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

  // Get all places
  async getPlaces(regionId = null) {
    let query = supabase
      .from('places')
      .select('*')
      .order('name', { ascending: true })

    if (regionId) {
      query = query.eq('region_id', regionId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching places:', error)
      return []
    }

    return data.map((place) => ({
      id: place.id,
      name: place.name,
      nameEn: place.name_en,
      status: place.status,
      wait: place.wait_time,
      lat: place.lat,
      lng: place.lng,
    }))
  },

  // Create a new post
  async createPost(postData) {
    const { placeId, placeName, vibe, mainImageUrl, additionalImageUrls, metadata, userId } = postData

    // Insert post
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({
        place_id: placeId || null,
        place_name: placeName,
        vibe: vibe,
        user_id: userId || null,
        main_image_url: mainImageUrl,
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
}
