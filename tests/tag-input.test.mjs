import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import ts from 'typescript'

const tagUrl = new URL('../src/admin/TagInput.tsx', import.meta.url)
const autocompleteUrl = new URL('../src/admin/AutocompleteInput.tsx', import.meta.url)
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === tagUrl.href && specifier === './AutocompleteInput')
      return nextResolve(autocompleteUrl.href, context)
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if ([tagUrl.href, autocompleteUrl.href].includes(url)) {
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: {
            jsx: ts.JsxEmit.ReactJSX,
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
          },
        }).outputText,
      }
    }
    return nextLoad(url, context)
  },
})
let TagInput
try {
  ;({ TagInput } = await import(tagUrl.href))
} finally {
  hooks.deregister()
}

test('자동완성 선택은 서버 태그 객체의 ID·이름을 전달하고 확정 동작은 Enter·추가 콜백으로 남긴다', () => {
  for (const length of [1, 31, 80]) {
    const tag = { tag_id: length + 10, name: '가'.repeat(length) }
    const selected = []
    let added = 0
    let typed = ''
    const input = TagInput({
      value: tag.name,
      options: [tag],
      onChange: (value) => {
        typed = value
      },
      onSelect: (value) => selected.push(value),
      onAdd: () => added++,
      invalid: false,
      describedBy: 'help',
    })
    assert.deepEqual(input.props.options, [{ id: String(tag.tag_id), label: tag.name }])
    input.props.onSelect({ id: String(tag.tag_id), label: '표시 문자열만 사용하지 않음' })
    assert.equal(selected[0], tag)
    assert.equal(added, 0, '자동완성 선택만으로 저장 목록에 확정하지 않음')
    input.props.onConfirm()
    assert.equal(added, 1)
    input.props.onChange('새 입력')
    assert.equal(typed, '새 입력')
    assert.equal(input.props.maxLength, undefined, '검색 입력을 신규 생성 길이로 제한하지 않음')
  }
})
