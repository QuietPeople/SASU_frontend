import { Link } from 'react-router'
import { useSession } from '../state/session'
import { Button, Spinner, StateBlock } from '../shared/ui'
import '../styles/sasu-pages.css'

export function HomePage() {
  const session = useSession()
  return (
    <div className="sasu-home2">
      {session.isPending ? (
        <Spinner />
      ) : session.error ? (
        <StateBlock
          title="서버에 연결하지 못했습니다."
          text={session.error.message}
          action={
            <Button
              onClick={() => {
                void session.refreshSession()
              }}
            >
              다시 시도
            </Button>
          }
        />
      ) : (
        <div className="sasu-split">
          {session.learnerId !== null ? (
            <Link to="/learner/search" className="sasu-split__half sasu-split__half--learner">
              <div>
                <span className="sasu-split__ic" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </span>
                <span className="sasu-split__badge">학습자 모드</span>
                <h2 className="sasu-split__title">영상으로 배우기</h2>
                <p className="sasu-split__desc">검색·시청, 퀴즈, 오답 복습까지 한 흐름으로.</p>
              </div>
              <span className="sasu-split__go">시작하기 →</span>
            </Link>
          ) : (
            <StateBlock title="등록된 학습자가 없습니다." />
          )}
          {session.adminId !== null ? (
            <Link to="/admin/contents" className="sasu-split__half sasu-split__half--admin">
              <div>
                <span className="sasu-split__ic" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="4" rx="1" />
                    <rect x="3" y="11" width="12" height="4" rx="1" />
                    <rect x="3" y="18" width="16" height="3" rx="1" />
                  </svg>
                </span>
                <span className="sasu-split__badge">제작자·관리 모드</span>
                <h2 className="sasu-split__title">콘텐츠 관리</h2>
                <p className="sasu-split__desc">영상·문항 등록과 공개, 학습 통계 확인.</p>
              </div>
              <span className="sasu-split__go">관리 시작 →</span>
            </Link>
          ) : (
            <StateBlock title="등록된 관리자가 없습니다." />
          )}
        </div>
      )}
    </div>
  )
}