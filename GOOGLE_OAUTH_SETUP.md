# Google OAuth 설정 가이드

SpotVibe에서 Google 로그인을 사용하기 위해 Supabase와 Google Cloud Console에서 설정이 필요합니다.

## 1. Google Cloud Console 설정

### 1.1 프로젝트 생성 및 OAuth 동의 화면 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. **API 및 서비스 > 사용자 인증 정보** 메뉴로 이동
4. **OAuth 동의 화면 구성** 클릭
   - 사용자 유형: **외부** 선택
   - 앱 이름: `SpotVibe` 입력
   - 사용자 지원 이메일: 본인 이메일 선택
   - 개발자 연락처 정보: 본인 이메일 입력
   - **저장 후 계속** 클릭
5. **범위** 단계에서 **저장 후 계속** 클릭 (기본 범위 사용)
6. **테스트 사용자** 단계에서 본인 이메일 추가 (테스트 단계)
7. **대시보드로 돌아가기** 클릭

### 1.2 OAuth 2.0 클라이언트 ID 생성

1. **API 및 서비스 > 사용자 인증 정보** 메뉴로 이동
2. **+ 사용자 인증 정보 만들기 > OAuth 클라이언트 ID** 선택
3. 애플리케이션 유형: **웹 애플리케이션** 선택
4. 이름: `SpotVibe Web Client` 입력
5. **승인된 리디렉션 URI** 섹션에서 **URI 추가** 클릭
   - Supabase Dashboard에서 제공하는 리디렉션 URL을 입력해야 합니다.
   - 형식: `https://[your-project-ref].supabase.co/auth/v1/callback`
   - Supabase Dashboard > Authentication > URL Configuration에서 확인 가능
6. **만들기** 클릭
7. **클라이언트 ID**와 **클라이언트 보안 비밀번호**를 복사해 둡니다.

## 2. Supabase 설정

### 2.1 Google Provider 활성화

1. Supabase Dashboard 접속
2. 프로젝트 선택
3. **Authentication > Providers** 메뉴로 이동
4. **Google** 프로바이더 찾기
5. **Enable Google** 토글 활성화

### 2.2 Google OAuth 인증 정보 입력

1. Google Cloud Console에서 복사한 정보 입력:
   - **Client ID (for OAuth)**: Google Cloud Console의 클라이언트 ID
   - **Client Secret (for OAuth)**: Google Cloud Console의 클라이언트 보안 비밀번호
2. **Save** 클릭

### 2.3 리디렉션 URL 확인

1. **Authentication > URL Configuration** 메뉴로 이동
2. **Redirect URLs** 섹션에서 기본 리디렉션 URL 확인
   - 형식: `https://[your-project-ref].supabase.co/auth/v1/callback`
3. 이 URL을 Google Cloud Console의 승인된 리디렉션 URI에 추가했는지 확인

## 3. 앱에서 테스트

### 3.1 개발 환경

1. 개발 서버 실행:
   ```bash
   npm run dev
   ```

2. 앱에서 **Post Vibe** 버튼 클릭
3. 로그인 모달이 나타나면 **Sign in with Google** 클릭
4. Google 로그인 화면으로 리디렉션됨
5. 로그인 성공 시 앱으로 돌아와서 Post Vibe 모달이 자동으로 열림

### 3.2 프로덕션 환경

프로덕션 배포 시:
1. Google Cloud Console에서 **승인된 리디렉션 URI**에 프로덕션 도메인 추가
2. Supabase Dashboard에서 **Site URL** 설정 확인

## 4. 문제 해결

### 로그인 후 리디렉션되지 않음

- Google Cloud Console의 **승인된 리디렉션 URI**에 Supabase 리디렉션 URL이 정확히 입력되었는지 확인
- Supabase Dashboard의 **URL Configuration**에서 리디렉션 URL 확인

### "redirect_uri_mismatch" 오류

- Google Cloud Console의 리디렉션 URI와 Supabase의 리디렉션 URL이 정확히 일치해야 합니다.
- 대소문자, 슬래시(/) 등 모든 문자가 일치해야 합니다.

### 로그인은 되지만 사용자 정보가 표시되지 않음

- Supabase Dashboard > Authentication > Users에서 사용자 정보 확인
- `user_metadata`에 `full_name`, `avatar_url` 등이 포함되어 있는지 확인

## 5. 다음 단계

- 프로덕션 배포 시 Google OAuth 동의 화면을 **프로덕션**으로 승인받기
- 추가 사용자 정보를 저장하려면 Database에 `profiles` 테이블 생성 고려
