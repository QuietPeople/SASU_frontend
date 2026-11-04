// 요소를 재사용하는 동안 src와 버퍼를 유지하고, 준비 범위를 벗어나면 요청과 버퍼를 해제한다.
export function retainVideoBuffer(video: HTMLVideoElement, source: string) {
  if (video.getAttribute('src') !== source) {
    video.src = source
    video.load()
  }
  return () => {
    video.pause()
    video.removeAttribute('src')
    video.load()
  }
}

const activeEvents = [
  'play',
  'volumechange',
  'playing',
  'waiting',
  'ratechange',
  'timeupdate',
  'pause',
  'seeking',
  'seeked',
  'ended',
  'error',
] as const
export type ActiveVideoEvent = (typeof activeEvents)[number]

export function bindActiveVideoEvents(
  video: HTMLVideoElement,
  handle: (type: ActiveVideoEvent) => void,
) {
  const controller = new AbortController()
  for (const type of activeEvents)
    video.addEventListener(type, () => handle(type), { signal: controller.signal })
  if (video.error) handle('error')
  return () => controller.abort()
}
