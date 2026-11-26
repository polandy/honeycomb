// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { assetPills, clockDuration } from '../../../src/logic/immich-pills.ts'
import { immichEntry } from './immich-fixtures.ts'

describe('assetPills', () => {
	// spec: IMMICH-002.37
	it('gives a live photo LIVE, a video its duration, a stack its size and a photo none', () => {
		expect(assetPills(immichEntry('p'))).toEqual([])
		expect(assetPills(immichEntry('l', { kind: 'live', duration: 1.5 }))).toEqual([{ kind: 'live' }])
		expect(assetPills(immichEntry('v', { kind: 'video', duration: 12.5 }))).toEqual([{ kind: 'video', duration: 12.5 }])
		expect(assetPills(immichEntry('s', { stackSize: 3 }))).toEqual([{ kind: 'stack', size: 3 }])
	})

	it('gives a video without a duration its pill and a stacked live photo both, the kind first', () => {
		expect(assetPills(immichEntry('v', { kind: 'video' }))).toEqual([{ kind: 'video', duration: null }])
		expect(assetPills(immichEntry('ls', { kind: 'live', stackSize: 2 }))).toEqual([{ kind: 'live' }, { kind: 'stack', size: 2 }])
	})

	it('gives a stack of one no stack pill', () => {
		expect(assetPills(immichEntry('s', { stackSize: 1 }))).toEqual([])
	})
})

describe('clockDuration', () => {
	// spec: IMMICH-002.37
	it('says whole seconds as m:ss, and h:mm:ss from an hour', () => {
		expect(clockDuration(0)).toBe('0:00')
		expect(clockDuration(0.9)).toBe('0:00')
		expect(clockDuration(12.5)).toBe('0:12')
		expect(clockDuration(59.99)).toBe('0:59')
		expect(clockDuration(60)).toBe('1:00')
		expect(clockDuration(605)).toBe('10:05')
		expect(clockDuration(3599)).toBe('59:59')
		expect(clockDuration(3600)).toBe('1:00:00')
		expect(clockDuration(36_061)).toBe('10:01:01')
	})
})
