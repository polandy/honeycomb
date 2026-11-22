// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Schedule } from '../logic/long-press.ts'
import type { MoveRequestFile, Probe } from '../logic/move-plan.ts'
import type { MoveResponseFile } from '../logic/move-report.ts'
import type { TrashExpectation, TrashRequestFile, TrashResponseFile } from '../logic/trash-report.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { browserSchedule } from '../browser-schedule.ts'
import { CHUNK_TIMEOUT_MS, LISTING_TIMEOUT_MS, withTimeout } from '../logic/timed-request.ts'
import { API, ApiResponseError, errorCodeOf, isRecord } from './core.ts'

/** The error code of an answer that says the trash bin is off. */
const TRASH_BIN_DISABLED = 'trash-bin-disabled'

/** Thrown when the trash bin app is off for the user; nothing was deleted (ADR 0013). */
export class TrashBinOffError extends Error {}

/** Moves each picture's files to the trash bin while their rows say `expect`, and returns the result of every file (ADR 0013, ADR 0040). */
export async function trashPictures(pictures: readonly (readonly TrashRequestFile[])[], expect: TrashExpectation | null = null, schedule: Schedule = browserSchedule): Promise<TrashResponseFile[][]> {
	const body = expect === null ? { pictures } : { pictures, expect }
	const data = await withTimeout((signal) => axios.post<unknown>(generateUrl(`${API}/trash`), body, { signal }), CHUNK_TIMEOUT_MS, schedule).then((response) => response.data, (error: unknown) => {
		throw errorCodeOf(error) === TRASH_BIN_DISABLED ? new TrashBinOffError('The trash bin is off; nothing was deleted.') : error
	})
	if (!isRecord(data) || !Array.isArray(data.pictures)) {
		throw new ApiResponseError('The trash response came without a pictures array; check the server\'s version.')
	}
	return data.pictures as TrashResponseFile[][]
}

/** What each target folder of a move already holds, and the storage of each target and source folder (ADR 0018). */
export async function probeTargets(folders: readonly string[], sources: readonly string[], schedule: Schedule = browserSchedule): Promise<Probe> {
	const { data } = await withTimeout((signal) => axios.post<unknown>(generateUrl(`${API}/move/targets`), { folders, sources }, { signal }), LISTING_TIMEOUT_MS, schedule)
	if (!isRecord(data) || !Array.isArray(data.folders) || !Array.isArray(data.sources)) {
		throw new ApiResponseError('The move target response came without a folders and a sources array; check the server\'s version.')
	}
	return { folders: data.folders as Probe['folders'], sources: data.sources as Probe['sources'] }
}

/** Moves each picture's files to their new paths and returns the result of every file (ADR 0018). */
export async function movePictures(pictures: readonly (readonly MoveRequestFile[])[], schedule: Schedule = browserSchedule): Promise<MoveResponseFile[][]> {
	const data = await withTimeout((signal) => axios.post<unknown>(generateUrl(`${API}/move`), { pictures }, { signal }), CHUNK_TIMEOUT_MS, schedule).then((response) => response.data, (error: unknown) => {
		throw errorCodeOf(error) === TRASH_BIN_DISABLED ? new TrashBinOffError('The trash bin is off; nothing was moved.') : error
	})
	if (!isRecord(data) || !Array.isArray(data.pictures)) {
		throw new ApiResponseError('The move response came without a pictures array; check the server\'s version.')
	}
	return data.pictures as MoveResponseFile[][]
}
