// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { NameTemplate } from '../logic/name-template/parse.ts'
import type { Settings } from '../logic/settings.ts'

import { computed, readonly, ref } from 'vue'
import { addJobCode, jobCodeReady, typedJobCode, usesJobCode } from '../logic/job-codes.ts'

/** The move dialog's job code: asked when the template uses it, prefilled with the last one (MOVE-005). */
export function useJobCode(settings: () => Settings, template: () => NameTemplate) {
	const code = ref('')
	const needed = computed(() => usesJobCode(template()))
	return {
		code: readonly(code),
		needed,
		ready: computed(() => !needed.value || jobCodeReady(code.value)),
		recent: computed(() => settings().moveJobCodes),
		/** Starts a move with the last job code. */
		reset: () => {
			code.value = settings().moveJobCodes[0] ?? ''
		},
		/** Takes the typed text, cut to its first 40 characters. */
		type: (text: string) => {
			code.value = typedJobCode(text)
		},
		/** The settings change that remembers the job code, none when the template does not use it. */
		remembered: (): Partial<Settings> => (needed.value ? { moveJobCodes: addJobCode(settings().moveJobCodes, code.value) } : {}),
	}
}

/** The job code of a move flow. */
export type JobCode = ReturnType<typeof useJobCode>
