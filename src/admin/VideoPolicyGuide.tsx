import type { VideoPolicy } from '../api/admin'
import { Icon } from './Icon'
import './video-policy-guide.css'

export function VideoPolicyGuide({ policy }: { policy: VideoPolicy }) {
  return (
    <section className="admin-video-policy" id="content-video-policy" aria-label="영상 업로드 기준">
      <h3>업로드 기준</h3>
      <dl className="admin-video-policy__limits">
        <div>
          <dt>파일 용량</dt>
          <dd>최대 {Math.round(policy.max_bytes / 1024 / 1024)} MB</dd>
        </div>
        <div>
          <dt>영상 길이</dt>
          <dd>
            {policy.min_duration_sec}–{policy.max_duration_sec}초
          </dd>
        </div>
        <div>
          <dt>해상도 · 긴 변 기준</dt>
          <dd>최대 {policy.max_long_edge_px.toLocaleString()}px</dd>
        </div>
      </dl>
      <div className="admin-video-policy__resize">
        <Icon name="video" size={18} />
        <div>
          <strong>큰 영상은 자동 축소해 저장해요</strong>
          <p>
            긴 변이 {policy.target_long_edge_px.toLocaleString()}px를 넘으면 비율을 유지하며 해당
            크기 이하로 줄여요. 작은 영상은 확대하지 않아요.
          </p>
        </div>
      </div>
      <details className="admin-video-policy__details">
        <summary>
          <span>지원 형식·해상도 자세히 보기</span>
          <Icon name="chevronDown" size={16} />
        </summary>
        <div className="admin-video-policy__detail-body">
          <div>
            <h4>지원 형식</h4>
            <ul>
              {policy.formats.map((format) => (
                <li key={format}>{format}</li>
              ))}
            </ul>
            <p>확장자가 같아도 영상·음성 코덱에 따라 업로드가 제한될 수 있어요.</p>
          </div>
          <div>
            <h4>해상도 확인</h4>
            <p>
              가로·세로 중 긴 쪽이 {policy.max_long_edge_px.toLocaleString()}px 이하여야 해요.
              가로형·세로형 모두 업로드할 수 있어요.
            </p>
            <ul className="admin-video-policy__examples">
              {policy.max_long_edge_px >= 1920 && (
                <li>
                  <strong>Full HD 가능</strong>
                  <span>1920 × 1080px / 1080 × 1920px</span>
                </li>
              )}
              <li>
                <strong>4K UHD {policy.max_long_edge_px >= 3840 ? '가능' : '불가'}</strong>
                <span>3840 × 2160px / 2160 × 3840px</span>
              </li>
            </ul>
          </div>
        </div>
      </details>
    </section>
  )
}
