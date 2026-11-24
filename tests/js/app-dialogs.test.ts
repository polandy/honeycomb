// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { useAppDialogs } from '../../src/app/app-dialogs.ts'

/** The app's dialogs over actions and toasts that record each call. */
function dialogs(fail = false) {
	const calls: string[] = []
	const act = (name: string) => async () => {
		calls.push(name)
		if (fail) {
			throw new Error('offline')
		}
	}
	const shown = useAppDialogs(
		{ clearCache: act('clear'), cleanUp: async () => (await act('clean up')(), 2), resetStatistics: act('reset') },
		{ show: () => calls.push('toast'), showError: () => calls.push('error') },
	)
	return { calls, shown }
}

describe('useAppDialogs', () => {
	it('opens no dialog at first, so none holds the keys', () => {
		const { shown } = dialogs()

		expect([shown.settingsOpen.value, shown.shortcutsOpen.value, shown.connectionOpen.value, shown.holdsKeys()]).toEqual([false, false, false, false])
	})

	it.each([
		['the settings', 'settingsOpen'],
		['the connection details', 'connectionOpen'],
	] as const)('holds the keys while %s are open', (_name, dialog) => {
		const { shown } = dialogs()

		shown[dialog].value = true

		expect(shown.holdsKeys()).toBe(true)
	})

	it('toggles the shortcut sheet, which leaves the keys to the app', () => {
		const { shown } = dialogs()

		shown.toggleShortcuts()
		const opened = [shown.shortcutsOpen.value, shown.holdsKeys()]
		shown.toggleShortcuts()

		expect([...opened, shown.shortcutsOpen.value]).toEqual([true, false, false])
	})

	it.each([
		['clearCache', 'clear'],
		['cleanUp', 'clean up'],
		['resetStatistics', 'reset'],
	] as const)('runs the settings action %s with a toast', async (action, call) => {
		const { calls, shown } = dialogs()

		await shown.settingsActions[action]()

		expect(calls).toEqual([call, 'toast'])
	})

	it('reports a failed settings action as an error', async () => {
		const { calls, shown } = dialogs(true)

		await shown.settingsActions.clearCache()

		expect(calls).toEqual(['clear', 'error'])
	})
})
