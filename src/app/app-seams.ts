// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserSeams } from './app-seams-browser.ts'
import type { CullSeams } from './app-seams-cull.ts'
import type { DialogSeams } from './app-seams-dialogs.ts'
import type { SourceSeams } from './app-seams-source.ts'

import { BROWSER_SEAMS } from './app-seams-browser.ts'
import { CULL_SEAMS } from './app-seams-cull.ts'
import { DIALOG_SEAMS } from './app-seams-dialogs.ts'
import { SOURCE_SEAMS } from './app-seams-source.ts'

/** The server and browser seams of the app, by area; tests replace them with fakes. */
export interface AppSeams extends SourceSeams, CullSeams, DialogSeams, BrowserSeams {}

/** The seams the app uses in production. */
export const APP_SEAMS = { ...SOURCE_SEAMS, ...CULL_SEAMS, ...DIALOG_SEAMS, ...BROWSER_SEAMS }
