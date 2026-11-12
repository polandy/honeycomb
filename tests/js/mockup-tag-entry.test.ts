// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { runInThisContext } from 'node:vm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const LONG_PRESS_MS = 600
const html = readFileSync('docs/mockup/tag-entry.html', 'utf8')
const script = /<script>([\s\S]*)<\/script>/.exec(html)?.[1] ?? ''
const expose = 'globalThis.mockup = { state: () => ({ sel: [...sel], selMode, loupeOpen, entryOpen, filterTags, photos, rows }) }'

interface State {
	sel: number[]
	selMode: boolean
	loupeOpen: boolean
	entryOpen: boolean
	filterTags: string[]
	photos: { tags: string[] }[]
	rows: { tag: string, create: boolean }[]
}
type Init = Record<string, unknown>

const state = () => (globalThis as unknown as { mockup: { state: () => State } }).mockup.state()
const tagsOf = (i: number) => state().photos[i]?.tags ?? []
const el = (id: string) => document.getElementById(id) as HTMLElement
const field = () => el('field') as HTMLInputElement
const tile = (i: number) => el('grid').children[i] as HTMLElement
const shown = () => [...el('grid').children].filter((c) => !(c as HTMLElement).hidden).length
const listeners: EventListener[] = []

function load() {
	const add = document.addEventListener.bind(document)
	vi.spyOn(document, 'addEventListener').mockImplementation((type: string, fn: EventListenerOrEventListenerObject) => {
		listeners.push(fn as EventListener)
		add(type, fn)
	})
	const doc = new DOMParser().parseFromString(html.replace(/<script>[\s\S]*<\/script>/, ''), 'text/html')
	document.body.replaceChildren(...doc.body.children)
	runInThisContext(`(() => {${script};${expose}})()`)
}

function fire(target: EventTarget, type: string, init: Init = {}) {
	target.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), init))
}
const click = (i: number, init: Init = {}) => fire(tile(i), 'click', init)
const key = (k: string, init: Init = {}) => fire(document, 'keydown', { key: k, ...init })
const fieldKey = (k: string, init: Init = {}) => fire(field(), 'keydown', { key: k, ...init })
function type(text: string) {
	field().value = text
	fire(field(), 'input')
}
function enter(text: string) {
	type(text)
	fieldKey('Enter')
}

function touch(i: number, holdMs = 0) {
	fire(tile(i), 'pointerdown', { pointerType: 'touch' })
	vi.advanceTimersByTime(holdMs)
	fire(tile(i), 'pointerup')
	fire(tile(i), 'click')
}
const longPress = (i: number) => touch(i, LONG_PRESS_MS)

beforeEach(() => {
	vi.useFakeTimers()
	load()
})
afterEach(() => {
	vi.useRealTimers()
	listeners.splice(0).forEach((fn) => document.removeEventListener('keydown', fn))
})

describe('tag entry mockup', () => {
	it('tags three photos picked with the Select button and mouse clicks', () => {
		el('select').click()
		;[0, 1, 2, 4].forEach((i) => click(i))
		expect(state().sel).toEqual([1, 2, 4])
		key('t')
		enter('Berg')
		expect([1, 2, 4].every((i) => tagsOf(i).includes('Berg'))).toBe(true)
		expect(tagsOf(3)).not.toContain('Berg')
	})

	it('tags three photos picked by long-press and taps', () => {
		longPress(1)
		touch(3)
		touch(5)
		expect(state()).toMatchObject({ sel: [1, 3, 5], selMode: true, loupeOpen: false })
		el('tags').click()
		enter('Berg')
		expect([1, 3, 5].every((i) => tagsOf(i).includes('Berg'))).toBe(true)
	})

	it('opens the loupe on a tap outside selection mode and leaves selection mode with Done', () => {
		touch(2)
		expect(state().loupeOpen).toBe(true)
		key('Escape')
		el('select').click()
		click(3)
		el('done').click()
		expect(state().selMode).toBe(false)
	})

	it('selects a range with Shift-click and toggles with Ctrl-click', () => {
		click(1)
		click(3, { shiftKey: true })
		expect(state().sel).toEqual([1, 2, 3])
		click(2, { ctrlKey: true })
		expect(state().sel).toEqual([1, 3])
	})

	it('cycles the matches with Tab, skips tags every target has and creates on Enter', () => {
		key('t')
		type('ber')
		fieldKey('Tab')
		expect(field().value).toBe('Berg')
		fieldKey('Tab')
		expect(field().value).toBe('Bergsee')
		fieldKey('Tab', { shiftKey: true })
		expect(field().value).toBe('Berg')
		type('natur/berg')
		expect(state().rows.some((r) => r.tag === 'Natur/Berg')).toBe(false)
		enter('Rain')
		expect(tagsOf(0)).toContain('Rain')
	})

	it('filters the grid by chosen tags and removes a filter chip', () => {
		key('f')
		enter('Natur/Berg')
		expect(shown()).toBe(3)
		type('Fam')
		fieldKey('Tab')
		fieldKey('Enter')
		expect(shown()).toBe(1)
		fieldKey('Backspace')
		expect(state().filterTags).toEqual(['Natur/Berg'])
		fieldKey('Escape')
		expect(state().entryOpen).toBe(false)
	})

	it('shows a tag on some of the selected photos as partial and removes it from all', () => {
		click(0)
		click(3, { shiftKey: true })
		key('t')
		const partial = [...el('chips').children].find((c) => c.textContent?.startsWith('Family'))
		expect(partial?.className).toContain('partial')
		;(partial?.lastElementChild as HTMLElement).click()
		expect(state().photos.some((p) => p.tags.includes('Family'))).toBe(false)
	})
})
