// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { NameTemplate } from './name-template/parse.ts'

import { sanitiseValue } from './name-template/sanitise.ts'

/** The most characters a job code holds (MOVE-005.7). */
export const MAX_JOB_CODE = 40

const RECENT_KEPT = 5

/** Whether the template names files with the job code. */
export function usesJobCode(template: NameTemplate): boolean {
	return [...template.folders.flat(), ...template.name].some((part) => part.kind === 'job')
}

/** Whether the job code names anything once sanitised. */
export function jobCodeReady(code: string): boolean {
	return sanitiseValue(code) !== ''
}

/** What the field keeps of the typed text: its first 40 characters. */
export function typedJobCode(text: string): string {
	return text.slice(0, MAX_JOB_CODE)
}

/** The recent job codes with the code first, each once, 5 kept. */
export function addJobCode(recent: readonly string[], code: string): string[] {
	return [code, ...recent.filter((each) => each !== code)].slice(0, RECENT_KEPT)
}

/** The stored job codes in order, each once, without those not ready or too long, 5 kept. */
export function parseJobCodes(value: unknown): string[] {
	const codes = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length <= MAX_JOB_CODE && jobCodeReady(item)) : []
	return [...new Set(codes)].slice(0, RECENT_KEPT)
}
