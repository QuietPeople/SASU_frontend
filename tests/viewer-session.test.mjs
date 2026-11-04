import test from 'node:test'
import assert from 'node:assert/strict'
import { createViewerSession } from '../src/features/content-viewer/viewerSession.ts'

test('음량·음소거는 같은 방문에서 이어지되 재생 상태와 다른 학습자의 설정은 공유하지 않는다', () => {
  const first = createViewerSession('learner:2:0')
  const second = createViewerSession('learner:3:1')
  first.update({ muted: true, volume: 0.3 })
  const snapshot = first.read()
  first.update({ volume: 0.5 })
  assert.equal(snapshot.volume, 0.3)
  assert.equal(first.read().muted, true)
  assert.equal(first.read().volume, 0.5)
  assert.equal('playing' in first.read(), false)
  assert.deepEqual(second.read(), { muted: false, volume: 1 })
})
