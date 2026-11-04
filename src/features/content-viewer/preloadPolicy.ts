export const VIDEO_PRELOAD_AHEAD = 2
export const VIDEO_PRELOAD_BEHIND = 1
export const LEARNING_PRELOAD_STALE_MS = 30_000

// 복기카드는 영상 개수에 포함하지 않는다. 현재 위치가 카드여도 양쪽 영상을 준비한다.
export function videoPreloadWindow(videoItems: readonly boolean[], activeIndex: number) {
  const indices = new Set<number>()
  if (videoItems[activeIndex]) indices.add(activeIndex)
  for (const [direction, limit] of [
    [1, VIDEO_PRELOAD_AHEAD],
    [-1, VIDEO_PRELOAD_BEHIND],
  ]) {
    let count = 0
    for (
      let index = activeIndex + direction;
      index >= 0 && index < videoItems.length;
      index += direction
    ) {
      if (!videoItems[index]) continue
      indices.add(index)
      if (++count >= limit) break
    }
  }
  return indices
}
