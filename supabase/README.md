# Supabase Database Setup Guide

## 데이터베이스 스키마 구조

### 1. Regions (지역)
- `id`: 지역 ID (예: 'Seongsu', 'Hongdae')
- `name`: 지역명
- `active`: 활성화 여부

### 2. Places (Hot Spots - 관리자 등록 장소)
- `id`: 장소 ID (자동 증가)
- `region_id`: 지역 ID (외래키)
- `name`: 장소명 (한글)
- `name_en`: 장소명 (영문)
- `status`: 현재 상태
- `wait_time`: 대기 시간
- `lat`, `lng`: 위도/경도

### 3. Posts (제보)
- `id`: 제보 ID (자동 증가)
- `place_id`: 장소 ID (외래키, nullable - 사용자가 직접 입력할 수도 있음)
- `place_name`: 장소명 (직접 입력 가능)
- `vibe`: 붐빔 정도 ('verybusy', 'busy', 'nowait', 'quiet', 'soldout')
- `user_id`: 사용자 ID (나중에 auth 연결)
- `metadata`: JSONB 형식의 메타데이터 (GPS 좌표, 촬영 시간 등)
- `main_image_url`: 메인 이미지 URL
- `created_at`, `updated_at`: 생성/수정 시간

### 4. Post Images (포스트 이미지)
- `id`: 이미지 ID (자동 증가)
- `post_id`: 제보 ID (외래키)
- `image_url`: 이미지 URL
- `is_main`: 메인 이미지 여부
- `captured_at`: 촬영 시간
- `image_order`: 이미지 순서

## 마이그레이션 실행 방법

### Supabase Dashboard에서 실행:

1. Supabase Dashboard 접속
2. SQL Editor 메뉴로 이동
3. `001_initial_schema.sql` 파일 내용을 복사하여 실행
4. `002_seed_data.sql` 파일 내용을 복사하여 실행

### 또는 Supabase CLI 사용:

```bash
# Supabase CLI 설치 (아직 안 했다면)
npm install -g supabase

# Supabase 프로젝트 초기화
supabase init

# 마이그레이션 실행
supabase db push
```

## Row Level Security (RLS)

현재 설정:
- **읽기**: 모든 사용자에게 공개 (SELECT)
- **쓰기**: 모든 사용자에게 공개 (INSERT)
- 나중에 인증 시스템 추가 시 수정 가능

## 다음 단계

1. Supabase 클라이언트 라이브러리 설치
2. 환경 변수 설정 확인
3. App.jsx에 Supabase 연결 코드 추가
