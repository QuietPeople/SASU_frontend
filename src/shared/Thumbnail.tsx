import { useEffect, useState } from 'react'
import './thumbnail.css'

export function Thumbnail({
  src,
  fallback = '이미지 없음',
  className = '',
  refreshKey = 0,
}: {
  src: string | null | undefined
  fallback?: string
  className?: string
  refreshKey?: number
}) {
  return (
    <ThumbnailImage
      key={`${src ?? ''}:${refreshKey}`}
      src={src}
      fallback={fallback}
      className={className}
    />
  )
}

function ThumbnailImage({
  src,
  fallback,
  className,
}: {
  src: string | null | undefined
  fallback: string
  className: string
}) {
  const [image, setImage] = useState<string>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!src) return
    const controller = new AbortController()
    let url: string | undefined
    // 교체 후에도 API URL이 같으므로 브라우저의 오래된 이미지를 재사용하지 않고 확인한다.
    void fetch(src, { cache: 'no-cache', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Thumbnail unavailable')
        const blob = await response.blob()
        if (controller.signal.aborted) return
        url = URL.createObjectURL(blob)
        setImage(url)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [src])
  return (
    <span className={`sasu-thumbnail ${className}`} aria-hidden="true">
      {image && !failed ? (
        <img src={image} alt="" onError={() => setFailed(true)} />
      ) : (
        <span>{fallback}</span>
      )}
    </span>
  )
}
