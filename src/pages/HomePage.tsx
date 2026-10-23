import { Link } from 'react-router';
import { sampleContents, sampleQuizzes } from '../state/sasuSample';
import '../styles/sasu-pages.css';

/**
 * 모드 선택 화면(로컬 시연용)
 * 학습자·관리자 이동은 로컬 데모의 작업 구분이며, 로그인·권한 기능이 아님(화면 설계서 1-1).
 * 카드에 적는 수치는 예시 데이터에서 계산함.
 */

export function HomePage() {
  const published = sampleContents.filter((c) => c.status === 'PUBLISHED').length;
  const draft = sampleContents.length - published;
  const quizzes = sampleQuizzes.length;

  return (
    <div className="sasu-page sasu-home">
      <header className="sasu-home__head">
        <p className="sasu-eyebrow">SASU</p>
        <h1 className="sasu-home__title">
          실무 용어와 업무 기본기를
          <br />
          짧은 영상으로 익힙니다.
        </h1>
        <p className="sasu-home__sub">보고 싶은 쪽을 골라 주세요. 로컬 시연용 전환이라 로그인은 없습니다.</p>
      </header>

      <div className="sasu-home__grid">
        <Link to="/learner/feed" className="sasu-home__card sasu-home__card--learner">
          <span className="sasu-home__badge">학습자 모드</span>
          <span className="sasu-home__cover" aria-hidden="true">
            <span className="sasu-home__play">▶</span>
          </span>
          <span className="sasu-home__name">피드에서 영상 보기</span>
          <span className="sasu-home__desc">세로 영상을 넘겨 보고, 영상이 끝나면 퀴즈를 풉니다. 좋아요와 저장도 할 수 있어요.</span>
          <ul className="sasu-home__list">
            <li>영상 {published}개</li>
            <li>퀴즈 {quizzes}개</li>
            <li>휠·방향키로 넘기기</li>
          </ul>
          <span className="sasu-home__go">학습자 화면으로 →</span>
        </Link>

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
          <span className="sasu-home__desc">등록한 콘텐츠를 찾아보고 상태를 확인합니다. 편집·학습자료·통계로 이어집니다.</span>
          <ul className="sasu-home__list">
            <li>공개 {published}개</li>
            <li>임시저장 {draft}개</li>
            <li>검색·상태 거르기</li>
          </ul>
          <span className="sasu-home__go">관리자 화면으로 →</span>
        </Link>
      </div>

      <p className="sasu-help sasu-home__note">주소로 바로 열 수도 있어요. /learner/feed · /admin/contents</p>
    </div>
  );
}
