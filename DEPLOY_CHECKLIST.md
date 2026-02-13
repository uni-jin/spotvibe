# 운영 배포 체크리스트

## 1. Supabase (운영 DB/Storage)

배포 전에 **Supabase 프로젝트(운영)** 에서 아래를 적용해 주세요.

### 1.1 마이그레이션 (아직 적용 안 했다면)

Supabase Dashboard **SQL Editor**에서 순서대로 실행하거나, CLI로 푸시:

```bash
# 로컬에서 운영 프로젝트 연결 후
supabase link --project-ref <운영프로젝트ref>
supabase db push
```

또는 Dashboard에서 다음 마이그레이션 파일 내용을 수동 실행:

- `019_display_dates_as_kst.sql` — 노출기간 한국 시간 그대로 저장
- `020_storage_allow_places_upload.sql` — 관리자 장소 썸네일 업로드 허용
- `021_place_display_periods.sql` — 복수 노출기간(place_display_periods) + admin_save_place 확장

### 1.2 Storage 정책 (020 적용 안 했다면)

Storage > Policies > `post-images` 버킷에 정책 추가:

- **Name:** Allow anon upload to places folder  
- **Operation:** INSERT  
- **Target:** anon  
- **WITH CHECK:**  
  `(bucket_id = 'post-images' AND (storage.foldername(name))[1] = 'places')`

---

## 2. 환경 변수 (Vercel)

Vercel Dashboard > 프로젝트 > **Settings** > **Environment Variables** 확인:

- `VITE_SUPABASE_URL` — 운영 Supabase URL  
- `VITE_SUPABASE_ANON_KEY` — 운영 anon key  
- (관리자 사용 시) `VITE_JWT_SECRET` — 운영용 시크릿

---

## 3. 프론트 배포 (Vercel)

### 방법 A: GitHub 푸시로 자동 배포

```bash
git add .
git commit -m "운영 배포: 노출기간 KST, 장소 삭제/정렬, 지도/Discover UX, Storage 정책 등"
git push origin main
```

### 방법 B: Vercel CLI로 배포

```bash
npm run build
vercel --prod
```

---

## 4. 배포 후 확인

- [ ] 관리자: 장소 등록/수정/삭제, 노출기간(한국 시간), 썸네일 업로드
- [ ] Discover: 장소 상세, Feed 섹션, Back to Map / Back to Discover
- [ ] 지도: 장소 핀 클릭 → View Detail → 상세 → Back to Map
- [ ] 포스트 상세에서 뒤로가기 시 이전 화면(Discover 상세 등) 복귀
