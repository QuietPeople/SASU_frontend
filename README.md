# SASU Front

SASU 학습자·관리자 화면을 위한 React 프론트엔드입니다.

**`pages/`와 `features/`는 구조를 보여주는 미구현 예시입니다.** 예시 페이지는 아직 라우터에 연결하지 않았으며, 현재 `/`에는 실행 확인용 SASU 제목만 표시합니다.

## 기술 스택

- Node.js 24 · npm 11
- React 19 · TypeScript 6 · Vite 8
- React Router · TanStack Query · CSS Modules
- ESLint · Prettier

정확한 패키지 버전은 `package.json`과 `package-lock.json`에서 관리합니다.

## 디렉터리 구조

```text
src/
├── app/                          # 앱 초기화·공급자·라우터
│   ├── App.tsx
│   ├── providers.tsx
│   └── router.tsx
├── layouts/                      # 공통 메뉴·헤더·화면 틀
├── pages/                        # 레이아웃과 기능을 조합하는 페이지
│   ├── learner/
│   │   └── FeedPage.tsx           # 학습자 페이지 예시
│   └── admin/
│       └── ContentListPage.tsx    # 관리자 페이지 예시
├── features/                     # 기능별 UI·훅·타입
│   ├── content-viewer/           # 콘텐츠 시청 기능 예시
│   │   ├── ContentViewer.tsx
│   │   ├── useContentViewer.ts
│   │   └── types.ts
│   └── content-editor/           # 콘텐츠 편집 기능 예시
│       ├── ContentEditor.tsx
│       ├── useContentEditor.ts
│       └── types.ts
├── api/                          # 공통 HTTP client·영역별 요청 함수
├── components/                   # 공통 버튼·입력·모달 등 UI
├── hooks/                        # 여러 기능에서 사용하는 공통 훅
├── types/                        # 공유 API 요청·응답 타입
├── state/                        # 공통 사용자 문맥·탭 상태
├── styles/                       # 공통 디자인 변수·전역 스타일
└── main.tsx
```

특정 기능에서만 쓰는 UI·훅·타입·스타일은 해당 `features/<기능>/` 안에 둡니다. 서버 데이터 캐시는 TanStack Query로 관리합니다.

## 새 기능 추가 예시

검색 기능을 추가한다면 다음처럼 확장합니다. 아래 파일은 설명용이며 아직 생성하지 않았습니다.

1. `features/search/`에 `SearchForm.tsx`, `useSearch.ts` 등 필요한 파일을 작성합니다.
2. 서버 요청 함수는 `api/`, 공유 API 타입은 `types/`에 추가합니다.
3. `pages/learner/SearchPage.tsx`에서 검색 기능과 레이아웃을 조합합니다.
4. 페이지를 `app/router.tsx`에 연결합니다.

예시 파일 구성을 모든 기능에 동일하게 만들 필요는 없습니다.

## 실행

```sh
npm ci
npm run dev
```

개발 주소는 `http://localhost:5173`입니다. 포트가 사용 중이면 오류를 표시합니다.

필요한 설정은 `.env.example`을 참고해 `.env`에 작성합니다.

| 설정               | 기본값                  |
| ------------------ | ----------------------- |
| `DEV_SERVER_PORT`  | `5173`                  |
| `API_PROXY_TARGET` | `http://localhost:8000` |

`/api/...` 요청은 같은 경로로 백엔드에 전달합니다. 실제 백엔드 주소는 Git에서 제외되는 `.env`에 관리하고, 설정 변경 후 개발 서버를 재시작합니다.

## 검사·빌드

```sh
npm run check   # 타입·ESLint·포맷 검사
npm run build   # 타입 검사·정적 파일 빌드
```
