// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** A folder of the owner's own photos to measure with instead of the drawn ones. */
const PHOTOS = process.env.HONEYCOMB_BUDGET_PHOTOS

/** A photo to upload: its JPEG and, from a real folder, the RAW of the same name. */
export interface BudgetPhoto {
	readonly jpeg: Buffer
	readonly raw: { readonly extension: string, readonly content: Buffer } | null
}

/** A 24 MP JPEG, 6000 × 4000, drawn in the browser: a gradient under a seeded noise tile. */
async function drawnPhoto(page: Page, seed: number): Promise<Buffer> {
	const base64 = await page.evaluate(async (seed) => {
		const tile = new OffscreenCanvas(509, 509)
		const noise = new ImageData(tile.width, tile.height)
		let state = seed
		for (let i = 0; i < noise.data.length; i++) {
			state = (Math.imul(state, 1103515245) + 12345) >>> 0
			noise.data[i] = i % 4 === 3 ? 64 : state >>> 24
		}
		tile.getContext('2d')!.putImageData(noise, 0, 0)

		const canvas = new OffscreenCanvas(6000, 4000)
		const context = canvas.getContext('2d')!
		const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
		gradient.addColorStop(0, `hsl(${seed * 97 % 360} 60% 30%)`)
		gradient.addColorStop(1, `hsl(${(seed * 97 + 140) % 360} 60% 70%)`)
		context.fillStyle = gradient
		context.fillRect(0, 0, canvas.width, canvas.height)
		context.fillStyle = context.createPattern(tile, 'repeat')!
		context.fillRect(0, 0, canvas.width, canvas.height)

		const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })).arrayBuffer())
		let binary = ''
		for (let start = 0; start < bytes.length; start += 0x8000) {
			binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000))
		}
		return btoa(binary)
	}, seed)
	return Buffer.from(base64, 'base64')
}

const SIDECAR = /\.(jpe?g|xmp)$/i

/** The RAW next to `jpegName` in `folder`: the file of the same stem that is no JPEG or sidecar. */
function rawOf(folder: string, jpegName: string): BudgetPhoto['raw'] {
	const stem = jpegName.replace(/\.[^.]+$/, '')
	const name = readdirSync(folder).find((candidate) => candidate.startsWith(`${stem}.`) && !SIDECAR.test(candidate))
	return name === undefined ? null : { extension: name.slice(stem.length + 1).toLowerCase(), content: readFileSync(join(folder, name)) }
}

/** The first `count` photos of `PHOTOS`, preferring RAW+JPEG pairs, else drawn 24 MP JPEGs. */
export async function budgetPhotos(page: Page, count: number): Promise<BudgetPhoto[]> {
	if (PHOTOS === undefined) {
		const drawn: BudgetPhoto[] = []
		for (let seed = 1; seed <= count; seed++) {
			drawn.push({ jpeg: await drawnPhoto(page, seed), raw: null })
		}
		return drawn
	}
	const names = readdirSync(PHOTOS).filter((name) => /\.jpe?g$/i.test(name)).sort()
	const pairs = names.filter((name) => rawOf(PHOTOS, name) !== null)
	const chosen = [...pairs, ...names.filter((name) => !pairs.includes(name))].slice(0, count)
	expect(chosen, `JPEGs in ${PHOTOS}`).toHaveLength(count)
	return chosen.map((name) => ({ jpeg: readFileSync(join(PHOTOS, name)), raw: rawOf(PHOTOS, name) }))
}
