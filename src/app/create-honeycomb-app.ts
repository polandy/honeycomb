// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ILogger } from '@nextcloud/logger'
import type { App as VueApp } from 'vue'

import { createApp } from 'vue'
import App from './App.vue'

/** The focus trap's error for a modal that left the page before its opening fade ended. */
const VANISHED_MODAL = /^`fallbackFocus` was specified but was not a node/

/** Creates the honeycomb Vue app; an error that reaches Vue goes to the given logger. */
export function createHoneycombApp(logger: ILogger): VueApp {
	const app = createApp(App)
	app.config.errorHandler = (error, _instance, info) => {
		if (error instanceof Error && VANISHED_MODAL.test(error.message)) {
			logger.debug('A dialog was closed while it opened, its focus trap is skipped', { error })
			return
		}
		logger.error('Unhandled error in the honeycomb UI', { error, info })
	}
	return app
}
