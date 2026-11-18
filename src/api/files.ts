// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MoveRequestFile, Probe } from '../logic/move-plan.ts'
import type { MoveResponseFile } from '../logic/move-report.ts'
import type { TrashRequestFile, TrashResponseFile } from '../logic/trash-report.ts'

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { API, ApiResponseError, isRecord } from './core.ts'

/** Thrown when the trash bin app is off for the user; nothing was deleted (ADR 0013). */
export class TrashBinOffError extends Error {}

/** Moves each picture's files to the trash bin and returns the result of every file (ADR 0013). */
export async function trashPictures(pictures: readonly (readonly TrashRequestFile[])[]): Promise<TrashResponseFile[][]> {
	const data = await axios.post<unknown>(generateUrl(`${API}/trash`), { pictures }).then((response) => response.data, (error: unknown) => {
		throw isRecord(error) && isRecord(error.response) && error.response.status === 409 ? new TrashBinOffError('The trash bin is off; nothing was deleted.') : error
	})
	if (!isRecord(data) || !Array.isArray(data.pictures)) {
		throw new ApiResponseError('The trash response came without a pictures array; check the server\'s version.')
	}
	return data.pictures as TrashResponseFile[][]
}

/** What each target folder of a move already holds, and the storage of each target and source folder (ADR 0018). */
export async function probeTargets(folders: readonly string[], sources: readonly string[]): Promise<Probe> {
	const { data } = await axios.post<unknown>(generateUrl(`${API}/move/targets`), { folders, sources })
	if (!isRecord(data) || !Array.isArray(data.folders) || !Array.isArray(data.sources)) {
		throw new ApiResponseError('The move target response came without a folders and a sources array; check the server\'s version.')
	}
	return { folders: data.folders as Probe['folders'], sources: data.sources as Probe['sources'] }
}

/** Moves each picture's files to their new paths and returns the result of every file (ADR 0018). */
export async function movePictures(pictures: readonly (readonly MoveRequestFile[])[]): Promise<MoveResponseFile[][]> {
	const data = await axios.post<unknown>(generateUrl(`${API}/move`), { pictures }).then((response) => response.data, (error: unknown) => {
		throw isRecord(error) && isRecord(error.response) && error.response.status === 409 ? new TrashBinOffError('The trash bin is off; nothing was moved.') : error
	})
	if (!isRecord(data) || !Array.isArray(data.pictures)) {
		throw new ApiResponseError('The move response came without a pictures array; check the server\'s version.')
	}
	return data.pictures as MoveResponseFile[][]
}
