import './skeleton.css'

type SkeletonVariant = 'page' | 'list' | 'form' | 'dashboard' | 'cards' | 'text' | 'video'
export function Skeleton({
  variant = 'list',
  label = '불러오는 중',
  count = 3,
}: {
  variant?: SkeletonVariant
  label?: string
  count?: number
}) {
  const line = (size: string) => (
    <span className={`sasu-skeleton__block sasu-skeleton__line sasu-skeleton__line--${size}`} />
  )
  return (
    <div
      className={`sasu-skeleton sasu-skeleton--${variant}`}
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <div className="sasu-skeleton__content" aria-hidden="true">
        {variant === 'page' && (
          <div className="sasu-skeleton__heading">
            {line('short')}
            {line('title')}
            {line('medium')}
          </div>
        )}
        {variant === 'video' ? (
          <div className="sasu-skeleton__video">
            <span className="sasu-skeleton__block sasu-skeleton__fill" />
            <div>
              {line('medium')}
              {line('short')}
            </div>
          </div>
        ) : variant === 'dashboard' ? (
          <>
            <div className="sasu-skeleton__metrics">
              {[0, 1, 2].map((n) => (
                <div key={n}>
                  <span className="sasu-skeleton__block sasu-skeleton__circle" />
                  {line('short')}
                </div>
              ))}
            </div>
            <div className="sasu-skeleton__columns">
              {[0, 1].map((n) => (
                <div key={n}>
                  {line('title')}
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="sasu-skeleton__row">
                      {line('medium')}
                      {line('short')}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        ) : variant === 'text' ? (
          <>
            {line('long')}
            {line('medium')}
            {line('short')}
          </>
        ) : variant === 'form' ? (
          <>
            {Array.from({ length: count }, (_, i) => (
              <div className="sasu-skeleton__field" key={i}>
                {line('short')}
                <span className="sasu-skeleton__block sasu-skeleton__input" />
              </div>
            ))}
          </>
        ) : variant === 'cards' ? (
          <div className="sasu-skeleton__cards">
            {Array.from({ length: count }, (_, i) => (
              <span key={i} className="sasu-skeleton__block sasu-skeleton__card" />
            ))}
          </div>
        ) : (
          Array.from({ length: count }, (_, i) => (
            <div className="sasu-skeleton__row" key={i}>
              <span className="sasu-skeleton__block sasu-skeleton__thumbnail" />
              <div>
                {line('title')}
                {line('long')}
                {line('short')}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
