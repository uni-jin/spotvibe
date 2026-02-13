# Supabase Storage 설정 가이드

Post Vibe 기능에서 이미지를 업로드하기 위해 Supabase Storage를 설정해야 합니다.

## 1. Storage 버킷 생성

1. Supabase Dashboard 접속
2. 좌측 메뉴에서 **Storage** 클릭
3. **New bucket** 버튼 클릭
4. 다음 정보 입력:
   - **Name**: `post-images`
   - **Public bucket**: ✅ 체크 (공개 버킷으로 설정)
5. **Create bucket** 클릭

## 2. Storage 정책 설정 (RLS)

Storage도 Row Level Security를 사용하므로 정책을 설정해야 합니다.

### 2.1 Storage Policies 메뉴로 이동

1. Storage 메뉴에서 **Policies** 탭 클릭
2. `post-images` 버킷 선택

### 2.2 Public Read Policy 생성

모든 사용자가 이미지를 읽을 수 있도록 설정:

1. **New Policy** 클릭
2. **For full customization** 선택
3. Policy 이름: `Allow public read access`
4. Allowed operation: `SELECT`
5. Policy definition:
   ```sql
   (bucket_id = 'post-images')
   ```
6. **Review** 클릭 후 **Save policy**

### 2.3 Authenticated Upload Policy 생성

로그인한 사용자가 이미지를 업로드할 수 있도록 설정:

1. **New Policy** 클릭
2. **For full customization** 선택
3. Policy 이름: `Allow authenticated upload`
4. Allowed operation: `INSERT`
5. Policy definition:
   ```sql
   (bucket_id = 'post-images' AND auth.role() = 'authenticated')
   ```
6. **Review** 클릭 후 **Save policy**

### 2.3-1 관리자 장소 썸네일 업로드 (anon 허용)

관리자 사이트는 Supabase Auth가 아닌 자체 JWT로 로그인하므로, 장소 썸네일 업로드 시 anon으로 요청됩니다.  
`post-images` 버킷의 **경로가 `places/` 로 시작하는 경우에만** anon이 INSERT 할 수 있도록 정책을 추가합니다.

1. **New Policy** 클릭
2. **For full customization** 선택
3. Policy 이름: `Allow anon upload to places folder`
4. Allowed operation: `INSERT`
5. Target roles: **anon**
6. Policy definition:
   ```sql
   (bucket_id = 'post-images' AND (storage.foldername(name))[1] = 'places')
   ```
7. **Review** 클릭 후 **Save policy**

(또는 마이그레이션 `020_storage_allow_places_upload.sql` 적용으로 동일 정책 추가 가능)

### 2.4 Authenticated Update Policy 생성 (선택사항)

이미지 업데이트가 필요한 경우:

1. **New Policy** 클릭
2. **For full customization** 선택
3. Policy 이름: `Allow authenticated update`
4. Allowed operation: `UPDATE`
5. Policy definition:
   ```sql
   (bucket_id = 'post-images' AND auth.role() = 'authenticated')
   ```
6. **Review** 클릭 후 **Save policy**

### 2.5 Authenticated Delete Policy 생성 (선택사항)

이미지 삭제가 필요한 경우:

1. **New Policy** 클릭
2. **For full customization** 선택
3. Policy 이름: `Allow authenticated delete`
4. Allowed operation: `DELETE`
5. Policy definition:
   ```sql
   (bucket_id = 'post-images' AND auth.role() = 'authenticated')
   ```
6. **Review** 클릭 후 **Save policy**

## 3. 테스트

Storage 설정이 완료되면:

1. 앱에서 Post Vibe 기능 사용
2. 이미지 업로드 시도
3. Supabase Dashboard > Storage > `post-images` 버킷에서 업로드된 이미지 확인

## 4. 문제 해결

### 이미지 업로드 실패

- Storage 버킷이 생성되었는지 확인
- RLS 정책이 올바르게 설정되었는지 확인
- 브라우저 콘솔에서 에러 메시지 확인

### 이미지가 보이지 않음

- 버킷이 Public으로 설정되었는지 확인
- 이미지 URL이 올바른지 확인 (Supabase Storage의 Public URL 형식)

### 권한 오류

- 사용자가 로그인되어 있는지 확인
- RLS 정책에서 `auth.role() = 'authenticated'` 조건 확인
