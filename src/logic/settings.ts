// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Flag } from './decision.ts'
import type { SwipeSetting } from './loupe-gesture.ts'
import type { FolderMode, PairingSettings } from './pairing.ts'

import { DEFAULT_SWIPES } from './loupe-gesture.ts'
import { DEFAULT_PAIRING_SETTINGS } from './pairing.ts'
import { SIDECAR_EXTENSION } from './sidecars.ts'

/** The per-user settings (`docs/plan.md` M4 item 4, ADR 0014). */
export interface Settings extends PairingSettings {
	readonly showSingles: boolean
	readonly swipes: SwipeSetting
	readonly autoAdvance: boolean
	readonly flagButtonsShown: boolean
	readonly viKeys: boolean
}

/** One of the two extension lists. */
export type ExtensionList = 'rawExtensions' | 'renderedExtensions'

/** Why an extension is not added. */
export type ExtensionRefusal = 'empty' | 'sidecar' | 'invalid' | 'in-this-list' | 'in-other-list'

/** The subfolder names a switch to separate subfolders starts with, as in the mockup. */
export const DEFAULT_SUBFOLDERS = { rawSubfolder: 'RAW', renderedSubfolder: 'JPG' } as const

/** What a user without stored settings gets. */
export const DEFAULT_SETTINGS: Settings = {
	...DEFAULT_PAIRING_SETTINGS,
	showSingles: true,
	swipes: DEFAULT_SWIPES,
	autoAdvance: true,
	flagButtonsShown: true,
	viKeys: false,
}

const OTHER_LIST: Record<ExtensionList, ExtensionList> = { rawExtensions: 'renderedExtensions', renderedExtensions: 'rawExtensions' }
const SWIPE_FLAGS: readonly (Flag | null)[] = ['picked', 'rejected', null]

/** The settings as stored, each missing or invalid field at its default; pairing never fails on them. */
export function parseSettings(value: unknown): Settings {
	const stored: Record<string, unknown> = isObject(value) ? value : {}
	const boolean = (key: 'showSingles' | 'autoAdvance' | 'flagButtonsShown' | 'viKeys') => (typeof stored[key] === 'boolean' ? stored[key] : DEFAULT_SETTINGS[key])
	return {
		...extensionLists(stored.rawExtensions, stored.renderedExtensions),
		folderMode: parseFolderMode(stored.folderMode),
		showSingles: boolean('showSingles'),
		swipes: parseSwipes(stored.swipes),
		autoAdvance: boolean('autoAdvance'),
		flagButtonsShown: boolean('flagButtonsShown'),
		viKeys: boolean('viKeys'),
	}
}

/** What pairing reads of the settings. */
export function pairingSettings(settings: Settings): PairingSettings {
	return { rawExtensions: settings.rawExtensions, renderedExtensions: settings.renderedExtensions, folderMode: settings.folderMode }
}

/** The folder mode of the kind; an empty subfolder name takes its default. */
export function folderMode(kind: FolderMode['kind'], rawSubfolder: string, renderedSubfolder: string): FolderMode {
	if (kind === 'same-folder') {
		return { kind }
	}
	const name = (value: string, fallback: string) => value.trim() || fallback
	return { kind, rawSubfolder: name(rawSubfolder, DEFAULT_SUBFOLDERS.rawSubfolder), renderedSubfolder: name(renderedSubfolder, DEFAULT_SUBFOLDERS.renderedSubfolder) }
}

/** The settings with the typed extension added to the list, or why it is not added. */
export function addExtension(settings: Settings, list: ExtensionList, input: string): { settings: Settings } | { refused: ExtensionRefusal } {
	const extension = normalizeExtension(input)
	const refused = extensionRefusal(extension)
		?? (settings[list].includes(extension) ? 'in-this-list' : null)
		?? (settings[OTHER_LIST[list]].includes(extension) ? 'in-other-list' : null)
	return refused === null ? { settings: { ...settings, [list]: [...settings[list], extension] } } : { refused }
}

/** The settings without the extension; the last one of a list stays. */
export function removeExtension(settings: Settings, list: ExtensionList, extension: string): Settings {
	return settings[list].length > 1 ? { ...settings, [list]: settings[list].filter((listed) => listed !== extension) } : settings
}

/** Both lists, or both defaults when either is invalid or they share an extension. */
function extensionLists(raw: unknown, rendered: unknown): Pick<Settings, ExtensionList> {
	const rawExtensions = parseExtensions(raw) ?? DEFAULT_SETTINGS.rawExtensions
	const renderedExtensions = parseExtensions(rendered) ?? DEFAULT_SETTINGS.renderedExtensions
	return rawExtensions.some((extension) => renderedExtensions.includes(extension))
		? { rawExtensions: DEFAULT_SETTINGS.rawExtensions, renderedExtensions: DEFAULT_SETTINGS.renderedExtensions }
		: { rawExtensions, renderedExtensions }
}

/** The normalised list without repeats, or null when it is empty or holds an invalid extension. */
function parseExtensions(value: unknown): string[] | null {
	if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === 'string')) {
		return null
	}
	const extensions = value.map(normalizeExtension)
	return extensions.every((extension) => extensionRefusal(extension) === null) ? [...new Set(extensions)] : null
}

/** The stored folder mode, the same folder when it is not a known one. */
function parseFolderMode(value: unknown): FolderMode {
	if (!isObject(value) || value.kind !== 'separate-subfolders') {
		return { kind: 'same-folder' }
	}
	const name = (field: unknown) => (typeof field === 'string' ? field : '')
	return folderMode('separate-subfolders', name(value.rawSubfolder), name(value.renderedSubfolder))
}

/** The stored swipes, each invalid direction at its default. */
function parseSwipes(value: unknown): SwipeSetting {
	const stored: Record<string, unknown> = isObject(value) ? value : {}
	const flag = (direction: 'up' | 'down') => (SWIPE_FLAGS.includes(stored[direction] as Flag | null) ? stored[direction] as Flag | null : DEFAULT_SWIPES[direction])
	return { up: flag('up'), down: flag('down') }
}

/** As pairing reads an extension: trimmed, without a leading dot, in lower case. */
function normalizeExtension(input: string): string {
	return input.trim().replace(/^\./, '').trim().toLowerCase()
}

/** Why the normalised extension can never mark a member, or null when it can. */
function extensionRefusal(extension: string): ExtensionRefusal | null {
	if (extension === '') {
		return 'empty'
	}
	if (extension === SIDECAR_EXTENSION) {
		return 'sidecar'
	}
	return /^[\p{L}\p{N}]+$/u.test(extension) ? null : 'invalid'
}

/** A JSON object, not a list. */
function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
