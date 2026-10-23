import { Link } from 'react-router'
import { useSession } from '../state/session'
import { Button, Spinner, StateBlock } from '../shared/ui'
import '../styles/sasu-pages.css'

export function HomePage() {
  const session = useSession()
  return (
    <div className="sasu-page sasu-home">
      <header className="sasu-home__head">
        <p className="sasu-eyebrow">SASU</p>
        <h1 className="sasu-home__title">
          실무 용어와 업무 기본기를
          <br />
          짧은 영상으로 익힙니다.
        </h1>
        <p className="sasu-home__sub">
          학습자 또는 관리자 화면을 선택해 주세요. 서버에 등록된 시연용 사용자로 이용합니다.
        </p>
      </header>
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
        <div className="sasu-home__grid">
          {session.learnerId !== null ? (
            <Link to="/learner/search" className="sasu-home__card sasu-home__card--learner">
              <span className="sasu-home__badge">학습자 모드</span>
              <span className="sasu-home__cover" aria-hidden="true">
                <span className="sasu-home__play">▶</span>
              </span>
              <span className="sasu-home__name">콘텐츠 찾아보고 학습하기</span>
              <span className="sasu-home__desc">
                공개된 영상을 검색하고, 퀴즈와 복습으로 학습을 이어갑니다.
              </span>
              <ul className="sasu-home__list">
                <li>콘텐츠 검색·시청</li>
                <li>좋아요·보관함</li>
                <li>퀴즈·오답 복습</li>
              </ul>
              <span className="sasu-home__go">학습자 화면으로 →</span>
            </Link>
          ) : (
            <StateBlock title="등록된 학습자가 없습니다." />
          )}
          {session.adminId !== null ? (
            <Link to="/admin/contents" className="sasu-home__card sasu-home__card--admin">
              <span className="sasu-home__badge">제작자·관리 모드</span>
              <span className="sasu-home__cover sasu-home__cover--admin" aria-hidden="true">
                <span className="sasu-home__rows">
                  <span />
                  <span />
                  <span />
                </span>
              </span>
              <span className="sasu-home__name">콘텐츠 등록하고 관리하기</span>
              <span className="sasu-home__desc">
                콘텐츠와 학습자료를 등록하고 공개 상태와 실제 학습 통계를 확인합니다.
              </span>
              <ul className="sasu-home__list">
                <li>영상 업로드·공개</li>
                <li>학습자료·시리즈 관리</li>
                <li>반응·학습 통계</li>
              </ul>
              <span className="sasu-home__go">관리자 화면으로 →</span>
            </Link>
          ) : (
            <StateBlock title="등록된 관리자가 없습니다." />
          )}
        </div>
      )}
    </div>
  )
}
