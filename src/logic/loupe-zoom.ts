// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** A width and height in CSS pixels. */
export interface Size {
	readonly width: number
	readonly height: number
}

/** A point relative to the stage's centre, in CSS pixels. */
export interface Point {
	readonly x: number
	readonly y: number
}

/** The photo's scale over its fitted size and its offset from the stage's centre. */
export interface Zoom {
	readonly scale: number
	readonly x: number
	readonly y: number
}

/** The photo fitted to the stage. */
export const FIT: Zoom = { scale: 1, x: 0, y: 0 }

/** Below this scale the photo counts as fitted, so a pinch that ends close to fit snaps back. */
const ZOOMED_FROM = 1.02

/** The size of a photo of `aspect` (width over height) fitted inside the stage. */
export function fitSize(aspect: number, stage: Size): Size {
	const width = Math.min(stage.width, stage.height * aspect)
	return { width, height: width / aspect }
}

/** The scale at which one pixel of the full image is one device pixel, at least fit. */
export function fullScale(fullLongEdge: number, fitted: Size, devicePixelRatio: number): number {
	return Math.max(1, fullLongEdge / devicePixelRatio / Math.max(fitted.width, fitted.height))
}

/** Whether the photo is zoomed in beyond fit. */
export function isZoomed(zoom: Zoom): boolean {
	return zoom.scale >= ZOOMED_FROM
}

/** The zoom with its offset limited so no edge of the photo moves into the stage. */
function clampPan(zoom: Zoom, fitted: Size, stage: Size): Zoom {
	if (zoom.scale <= 1) {
		return FIT
	}
	const maxX = Math.max(0, (fitted.width * zoom.scale - stage.width) / 2)
	const maxY = Math.max(0, (fitted.height * zoom.scale - stage.height) / 2)
	return { scale: zoom.scale, x: clamp(zoom.x, -maxX, maxX), y: clamp(zoom.y, -maxY, maxY) }
}

/** Zooms to `scale` between fit and `maxScale`, keeping the photo's spot under `point` in place. */
export function zoomAt(zoom: Zoom, point: Point, scale: number, maxScale: number, fitted: Size, stage: Size): Zoom {
	const next = clamp(scale, 1, maxScale)
	const x = point.x - (point.x - zoom.x) / zoom.scale * next
	const y = point.y - (point.y - zoom.y) / zoom.scale * next
	return clampPan({ scale: next, x, y }, fitted, stage)
}

/** The zoom moved by a drag of `dx`, `dy` from `start`. */
export function panBy(start: Zoom, dx: number, dy: number, fitted: Size, stage: Size): Zoom {
	return clampPan({ scale: start.scale, x: start.x + dx, y: start.y + dy }, fitted, stage)
}

/** Two fingers' centre and distance. */
export interface PinchCentre extends Point {
	readonly distance: number
}

/** The zoom of a pinch that began at `from` on `start` and now stands at `to`. */
export function pinchZoom(start: Zoom, from: PinchCentre, to: PinchCentre, maxScale: number, fitted: Size, stage: Size): Zoom {
	const scale = clamp(start.scale * (from.distance > 0 ? to.distance / from.distance : 1), 1, maxScale)
	const x = to.x - (from.x - start.x) / start.scale * scale
	const y = to.y - (from.y - start.y) / start.scale * scale
	return clampPan({ scale, x, y }, fitted, stage)
}

/** Fit when zoomed in, else the largest scale at `point`. */
export function toggleZoom(zoom: Zoom, point: Point, maxScale: number, fitted: Size, stage: Size): Zoom {
	return isZoomed(zoom) ? FIT : zoomAt(FIT, point, maxScale, maxScale, fitted, stage)
}

/** The zoom as a percentage of the full image, 100 at `fullScale`. */
export function zoomPercent(zoom: Zoom, fullScaleOfPhoto: number): number {
	return Math.round(zoom.scale / fullScaleOfPhoto * 100)
}

/** `value` limited to `min`…`max`. */
function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value))
}
