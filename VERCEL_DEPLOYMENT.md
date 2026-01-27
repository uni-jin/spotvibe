# Vercel 배포 가이드

## 방법 1: GitHub 푸시로 자동 배포 (권장)

이미 GitHub 저장소가 연결되어 있고 Vercel 프로젝트가 설정되어 있다면, 코드를 푸시하면 자동으로 배포됩니다.

### 배포 명령어

```bash
# 1. 변경사항 커밋
git add .
git commit -m "Post Vibe Supabase 연동 완료"

# 2. GitHub에 푸시
git push origin main
```

푸시 후 Vercel이 자동으로 빌드 및 배포를 시작합니다.

### 배포 상태 확인

1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. 프로젝트 선택
3. **Deployments** 탭에서 배포 상태 확인

---

## 방법 2: Vercel CLI를 사용한 배포

### 2.1 Vercel CLI 설치

```bash
npm install -g vercel
```

또는

```bash
npm install --save-dev vercel
```

### 2.2 Vercel 로그인

```bash
vercel login
```

브라우저가 열리면 Vercel 계정으로 로그인합니다.

### 2.3 프로젝트 배포

#### 처음 배포하는 경우 (프로젝트 설정)

```bash
vercel
```

다음 질문에 답변:
- Set up and deploy? **Y**
- Which scope? (계정 선택)
- Link to existing project? **Y** (기존 프로젝트가 있다면)
- What's the name of your project? `spotvibe` (또는 기존 프로젝트명)
- In which directory is your code located? `./` (현재 디렉토리)

#### 이후 배포 (프로덕션)

```bash
vercel --prod
```

또는

```bash
vercel -p
```

### 2.4 환경 변수 설정 확인

배포 전에 Vercel Dashboard에서 환경 변수가 설정되어 있는지 확인:

1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. 프로젝트 선택
3. **Settings** > **Environment Variables**
4. 다음 변수들이 설정되어 있는지 확인:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

---

## 배포 후 확인사항

### 1. Google OAuth 리디렉션 URI 확인

배포된 도메인(예: `https://spotvibe-k.vercel.app`)이 다음에 설정되어 있는지 확인:

1. **Google Cloud Console**
   - API 및 서비스 > 사용자 인증 정보
   - OAuth 2.0 클라이언트 ID 편집
   - 승인된 리디렉션 URI에 다음 추가:
     ```
     https://spotvibe-k.vercel.app/auth/v1/callback
     ```

2. **Supabase Dashboard**
   - Authentication > URL Configuration
   - Site URL: `https://spotvibe-k.vercel.app`
   - Redirect URLs에 Vercel 도메인 포함 확인

### 2. 기능 테스트

배포 후 다음 기능들을 테스트:

- [ ] 구글 로그인
- [ ] Post Vibe 이미지 업로드
- [ ] 포스트 저장 및 표시
- [ ] GPS 기반 기능

---

## 문제 해결

### 배포 실패

- Vercel Dashboard의 **Deployments** 탭에서 에러 로그 확인
- 환경 변수가 올바르게 설정되었는지 확인
- `package.json`의 `build` 스크립트가 올바른지 확인

### 환경 변수 오류

- Vercel Dashboard > Settings > Environment Variables에서 확인
- Production, Preview, Development 환경 모두에 설정되어 있는지 확인

### 구글 로그인 실패

- Google Cloud Console의 리디렉션 URI 확인
- Supabase의 Site URL 설정 확인
- 브라우저 콘솔에서 에러 메시지 확인

---

## 빠른 배포 명령어 요약

```bash
# GitHub 푸시 (자동 배포)
git add .
git commit -m "배포 메시지"
git push origin main

# 또는 Vercel CLI (수동 배포)
vercel --prod
```
