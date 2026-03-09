이 폴더에 CLAUDE.md, STYLE_REFERENCE.md, themes.css, mockup_ios.html이 있어.

먼저 CLAUDE.md를 전부 읽고 프로젝트 전체 맥락을 파악해줘.

그 다음 프로젝트를 초기화해줘:

1. SvelteKit 프로젝트 생성 (이 폴더를 루트로 사용, 기존 문서 파일은 /docs로 이동)
   - Svelte 4 + Vite + TypeScript (strict)
   - @sveltejs/adapter-node (Railway 배포용)
2. 필요한 패키지 설치:
   - pg (PostgreSQL)
   - bcryptjs (인증 — bcrypt 아님, 네이티브 빌드 불필요)
   - cookie (세션 쿠키 파싱)
   - chart.js (통계 차트)
   - xlsx (엑셀 내보내기, SheetJS)
3. svelte.config.js — adapter-node, envPrefix 설정
4. app.css 작성:
   - themes.css 내용을 최상단에 포함 (액센트 6종 + 배경 4종 + 고정색 CSS 변수 전부)
   - STYLE_REFERENCE.md의 전역 기본 스타일 (.dcell, .ev, .chip 등 전체 클래스)
   - 색상 하드코딩 절대 금지 (#fff 흰색 텍스트만 예외), 반드시 CSS 변수만 사용
5. app.html — Noto Sans KR (Google Fonts) 포함, CLAUDE.md의 app.html 템플릿 참고
6. src/lib/server/db.js — PostgreSQL Pool 연결 + 4개 테이블 자동 생성 (users, sessions, settings, records)
7. src/lib/server/auth.js — 세션 생성/검증/삭제 (쿠키 속성: httpOnly, secure, sameSite, path 반드시 포함)
8. src/hooks.server.js — DB 초기화 (await init()) + 전역 인증 미들웨어 (event.locals.user)
9. src/routes/api/auth/* — login, register, logout, me (+server.js 4개)
10. src/routes/login/+page.svelte — 로그인/회원가입 화면 (mockup_ios.html의 로그인 디자인 참고)
11. src/lib/server/calc.js — 서버사이드 calcRecord (540 고정, outM<=inM 가드 포함)
12. src/lib/calc.js — 클라이언트 동일 로직 (Svelte $: reactive용)
13. src/lib/constants.js — 공휴일 15개 + 유틸 (fmtMin, fmtW, pad, isWeekend)
14. src/lib/stores.js — settings, records, currentView, selectedDate (writable store)
15. src/routes/api/settings/+server.js — GET/PUT (camelCase ↔ snake_case 변환)
16. src/routes/api/records/+server.js — GET (월별 조회)
17. src/routes/api/records/[date]/+server.js — PUT (upsert, 서버 재계산) + DELETE
18. .env.example 생성 (DATABASE_URL, SESSION_SECRET, NODE_ENV, ORIGIN)
19. Procfile 생성 (web: node build/index.js)

주의사항:
- pg는 CommonJS — `import pg from 'pg'; const { Pool } = pg;` 패턴 사용
- PUT /api/records/:date는 클라이언트 계산값 무시, 서버에서 calcRecord() 재계산
- 540분은 절대 설정값으로 빼지 말 것 (고정값)
- Chart.js/SheetJS는 아직 import하지 마 (SSR 이슈, UI 단계에서 onMount로 처리)

CLAUDE.md의 기술 스택, 파일 구조, DB 스키마를 정확히 따라줘.
완료 후 `npm run dev`로 서버 뜨는지 확인하고, /login 페이지 접속 가능한지 확인해줘.
