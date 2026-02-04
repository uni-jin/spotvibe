# OAuth 무한 로딩 문제 해결 가이드

## 문제 증상
구글 로그인 시 무한 로딩이 발생하는 경우

## 확인해야 할 설정

### 1. Supabase Dashboard 설정

#### Authentication > URL Configuration
- **Site URL**: `https://spotvibe-k.vercel.app`
- **Redirect URLs**: 다음 URL들이 모두 포함되어 있는지 확인
  ```
  https://spotvibe-k.vercel.app
  https://spotvibe-k.vercel.app/*
  https://[your-project-ref].supabase.co/auth/v1/callback
  ```

#### Authentication > Providers > Google
- **Enable Google**: ✅ 활성화
- **Client ID (for OAuth)**: Google Cloud Console의 클라이언트 ID
- **Client Secret (for OAuth)**: Google Cloud Console의 클라이언트 Secret
- **Callback URL (for OAuth)**: 이 URL을 Google Cloud Console에 등록해야 함
  - 형식: `https://[your-project-ref].supabase.co/auth/v1/callback`

### 2. Google Cloud Console 설정

#### API 및 서비스 > 사용자 인증 정보
1. OAuth 2.0 클라이언트 ID 편집
2. **승인된 리디렉션 URI**에 다음을 모두 추가:
   ```
   https://[your-project-ref].supabase.co/auth/v1/callback
   https://spotvibe-k.vercel.app
   ```
   ⚠️ **중요**: Supabase의 Callback URL을 정확히 복사해서 등록해야 함

### 3. 코드 확인

#### 리디렉션 URL 설정
`src/lib/supabase.js`에서:
```javascript
redirectTo: `${window.location.origin}${window.location.pathname}`
```

#### OAuth 콜백 처리
`src/App.jsx`에서 URL hash 처리 로직이 있는지 확인

## 디버깅 방법

### 1. 브라우저 개발자 도구 확인
1. F12로 개발자 도구 열기
2. **Console** 탭에서 에러 메시지 확인
3. **Network** 탭에서 리디렉션 요청 확인
   - `/auth/v1/callback` 요청이 있는지 확인
   - 응답 상태 코드 확인

### 2. URL 확인
로그인 시도 후 브라우저 주소창의 URL 확인:
- `#access_token=...` 같은 hash가 있는지 확인
- 에러 파라미터가 있는지 확인 (`#error=...`)

### 3. Supabase 로그 확인
1. Supabase Dashboard > **Logs** > **Auth Logs**
2. 최근 인증 시도 확인
3. 에러 메시지 확인

## 일반적인 해결 방법

### 방법 1: Supabase Redirect URLs 재설정
1. Supabase Dashboard > Authentication > URL Configuration
2. Redirect URLs에 다음 추가:
   ```
   https://spotvibe-k.vercel.app
   https://spotvibe-k.vercel.app/*
   ```
3. 저장 후 몇 분 대기

### 방법 2: Google OAuth 설정 재확인
1. Google Cloud Console에서 OAuth 클라이언트 ID 확인
2. Supabase의 Callback URL을 정확히 복사
3. Google Cloud Console의 "승인된 리디렉션 URI"에 정확히 입력
4. 대소문자, 슬래시(/) 등 모든 문자가 일치해야 함

### 방법 3: 브라우저 캐시 및 쿠키 삭제
1. 브라우저 캐시 삭제
2. 쿠키 삭제 (특히 Supabase 관련)
3. 시크릿 모드에서 테스트

### 방법 4: 코드 업데이트 확인
최신 코드가 배포되었는지 확인:
1. Vercel Dashboard에서 배포 상태 확인
2. 브라우저에서 강력 새로고침 (Ctrl+Shift+R 또는 Cmd+Shift+R)

## 추가 확인사항

### 환경 변수 확인
Vercel Dashboard > Settings > Environment Variables:
- `VITE_SUPABASE_URL` 올바른지 확인
- `VITE_SUPABASE_ANON_KEY` 올바른지 확인

### Supabase 프로젝트 확인
- 올바른 Supabase 프로젝트에 연결되어 있는지 확인
- 새 계정으로 재설정했다면 모든 설정이 새 프로젝트 기준인지 확인

## 문제가 계속되면

1. Supabase Dashboard > Authentication > Users에서 사용자가 생성되었는지 확인
2. 브라우저 콘솔의 정확한 에러 메시지 확인
3. Network 탭에서 실패한 요청의 응답 본문 확인
