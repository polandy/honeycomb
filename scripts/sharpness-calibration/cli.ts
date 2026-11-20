// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Measures the JPEGs of each subfolder of a folder, one series each, as the cull does, and prints the report; reads only.
import type { MeasuredPhoto } from './report.ts'

import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import process from 'node:process'
import { LOUPE_TIER } from '../../src/logic/image-tiers.ts'
import { measureSharpness } from '../../src/logic/sharpness.ts'
import { seriesReport } from './report.ts'

const JPEG_PATTERN = /\.jpe?g$/i
/** ImageMagick's geometry that shrinks to the loupe tier and never enlarges, as the preview does. */
const LOUPE_GEOMETRY = `${LOUPE_TIER}x${LOUPE_TIER}>`
/** Room for the raw pixels of one loupe-tier photo. */
const MAX_BUFFER = LOUPE_TIER * LOUPE_TIER * 4 + 1

/** The photo at `path` shrunk to the loupe tier and measured. */
function measure(name: string, path: string): MeasuredPhoto {
	try {
		const size = execFileSync('magick', [path, '-resize', LOUPE_GEOMETRY, '-format', '%w %h', 'info:'], { encoding: 'utf8' })
		const [width, height] = size.trim().split(' ').map(Number) as [number, number]
		const rgba = execFileSync('magick', [path, '-resize', LOUPE_GEOMETRY, '-depth', '8', 'rgba:-'], { maxBuffer: MAX_BUFFER })
		return { name, ...measureSharpness(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.length), width, height) }
	} catch (error) {
		return { name, error: error instanceof Error ? error.message.split('\n')[0]! : String(error) }
	}
}

const folder = process.argv[2]
if (folder === undefined) {
	process.stderr.write('Usage: scripts/sharpness-calibration.sh <folder with one subfolder per series>\n')
	process.exit(2)
}
const seriesFolders = readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
for (const series of seriesFolders) {
	const names = readdirSync(`${folder}/${series}`).filter((name) => JPEG_PATTERN.test(name)).sort()
	process.stdout.write(`${seriesReport(series, names.map((name) => measure(name, `${folder}/${series}/${name}`))).join('\n')}\n`)
}
