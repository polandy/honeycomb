// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ImmichConnection } from './immich-connections.ts'
import type { Calendar, ImmichFilters } from './immich-filters.ts'

import { UNDECIDED } from './decision.ts'
import { defaultImmichFilters, timeRange } from './immich-filters.ts'
import { matchesDecision } from './picture-filter.ts'

/** Where the user stopped in a connection, by asset and capture time, and how far the cull got (IMMICH-003.14). */
export interface ImmichPosition {
	readonly connectionId: string
	readonly assetId: string
	readonly takenAt: number
	readonly decided: number
	readonly total: number
	readonly updatedAt: number
}

/** What a save of a connection's position sends; the server stamps the time. */
export type ImmichPositionSave = Omit<ImmichPosition, 'updatedAt'>

/** A connection under *Recent*: its label and how far its cull got (IMMICH-003.15). */
export interface RecentConnection {
	readonly connectionId: string
	readonly label: string
	readonly decided: number
	readonly total: number
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/** The connections' positions in the answer's order; the folder sets' and malformed ones are left out. */
export function parseImmichPositions(answer: unknown): ImmichPosition[] {
	if (!Array.isArray(answer)) {
		return []
	}
	return answer.flatMap((row: unknown): ImmichPosition[] => {
		if (!isRecord(row) || typeof row.immich !== 'string' || typeof row.assetId !== 'string') {
			return []
		}
		const { takenAt, decided, total, updatedAt } = row
		if (typeof takenAt !== 'number' || typeof decided !== 'number' || typeof total !== 'number' || typeof updatedAt !== 'number') {
			return []
		}
		return [{ connectionId: row.immich, assetId: row.assetId, takenAt, decided, total, updatedAt }]
	})
}

/** The filters a resume opens under: these if their time covers the asset and an undecided picture passes, else the defaults over the whole time. */
export function resumeFilters(filters: ImmichFilters, takenAt: number, now: number, calendar: Calendar): ImmichFilters {
	const { takenAfter, takenBefore } = timeRange(filters.time, now, calendar)
	const covers = (takenAfter === null || takenAfter <= takenAt) && (takenBefore === null || takenAt < takenBefore)
	if (covers && matchesDecision(UNDECIDED, filters)) {
		return filters
	}
	return { ...defaultImmichFilters(now, calendar), time: { kind: 'all' } }
}

/** The positions under *Recent* by their connection's label, in the positions' order; a connection the user no longer has is left out. */
export function recentConnections(positions: readonly ImmichPosition[], connections: readonly ImmichConnection[]): RecentConnection[] {
	return positions.flatMap(({ connectionId, decided, total }) => {
		const connection = connections.find(({ id }) => id === connectionId)
		return connection === undefined ? [] : [{ connectionId, label: connection.label, decided, total }]
	})
}

/** The positions with the saved one first, in place of its connection's earlier one. */
export function withImmichPosition(positions: readonly ImmichPosition[], saved: ImmichPosition): ImmichPosition[] {
	return [saved, ...positions.filter(({ connectionId }) => connectionId !== saved.connectionId)]
}
