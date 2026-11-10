// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { FIT, fitSize, fullScale, isZoomed, panBy, pinchZoom, toggleZoom, zoomAt, zoomPercent } from '../../../src/logic/loupe-zoom.ts'

const STAGE = { width: 1000, height: 800 }
const FITTED = { width: 1000, height: 500 }

describe('fitSize', () => {
	it('fits a landscape photo to the stage width and a portrait one to its height', () => {
		expect(fitSize(2, STAGE)).toEqual({ width: 1000, height: 500 })
		expect(fitSize(0.5, STAGE)).toEqual({ width: 400, height: 800 })
	})
})

describe('fullScale', () => {
	it('is the scale at which one image pixel is one device pixel', () => {
		expect(fullScale(6000, FITTED, 2)).toBe(3)
	})

	it('is never below fit', () => {
		expect(fullScale(800, FITTED, 1)).toBe(1)
	})

	it('measures the long edge of a portrait photo too', () => {
		expect(fullScale(4000, { width: 400, height: 800 }, 1)).toBe(5)
	})
})

describe('zoomAt', () => {
	it('keeps the point under the finger where it was', () => {
		const zoom = zoomAt(FIT, { x: 200, y: 100 }, 2, 4, FITTED, STAGE)

		expect(zoom.scale).toBe(2)
		expect(zoom.x).toBe(-200)
		expect(zoom.y).toBe(-100)
	})

	it('clamps the scale between fit and the largest scale', () => {
		expect(zoomAt(FIT, { x: 0, y: 0 }, 9, 3, FITTED, STAGE).scale).toBe(3)
		expect(zoomAt(FIT, { x: 0, y: 0 }, 0.5, 3, FITTED, STAGE)).toEqual(FIT)
	})

	it('never pans an edge of the photo into the stage', () => {
		const zoom = zoomAt(FIT, { x: 500, y: 400 }, 2, 4, FITTED, STAGE)

		expect(zoom.x).toBe(-500)
		expect(zoom.y).toBe(-100)
	})
})

describe('panBy', () => {
	it('moves the photo with the finger, within its edges', () => {
		const zoomed = { scale: 2, x: 0, y: 0 }

		expect(panBy(zoomed, 30, -20, FITTED, STAGE)).toEqual({ scale: 2, x: 30, y: -20 })
		expect(panBy(zoomed, 900, 900, FITTED, STAGE)).toEqual({ scale: 2, x: 500, y: 100 })
	})
})

describe('pinchZoom', () => {
	it('scales by the change of finger distance around the pinch centre', () => {
		const zoom = pinchZoom(FIT, { x: 100, y: 0, distance: 100 }, { x: 100, y: 0, distance: 200 }, 4, FITTED, STAGE)

		expect(zoom).toEqual({ scale: 2, x: -100, y: 0 })
	})

	it('follows the centre as both fingers move', () => {
		const zoom = pinchZoom({ scale: 2, x: 0, y: 0 }, { x: 0, y: 0, distance: 100 }, { x: 40, y: 10, distance: 100 }, 4, FITTED, STAGE)

		expect(zoom).toEqual({ scale: 2, x: 40, y: 10 })
	})

	it('treats two fingers on one spot as no change', () => {
		expect(pinchZoom(FIT, { x: 0, y: 0, distance: 0 }, { x: 0, y: 0, distance: 0 }, 4, FITTED, STAGE)).toEqual(FIT)
	})
})

describe('toggleZoom', () => {
	it('zooms to the largest scale at the point and back to fit', () => {
		const zoomed = toggleZoom(FIT, { x: 0, y: 0 }, 3, FITTED, STAGE)

		expect(zoomed.scale).toBe(3)
		expect(isZoomed(zoomed)).toBe(true)
		expect(toggleZoom(zoomed, { x: 0, y: 0 }, 3, FITTED, STAGE)).toEqual(FIT)
	})

	it('treats a scale barely above fit as fit', () => {
		expect(isZoomed({ scale: 1.01, x: 0, y: 0 })).toBe(false)
	})
})

describe('zoomPercent', () => {
	it('is the share of the full image shown, rounded', () => {
		expect(zoomPercent({ scale: 1.5, x: 0, y: 0 }, 3)).toBe(50)
	})
})
