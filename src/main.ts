// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHoneycombApp } from './create-honeycomb-app.ts'
import { logger } from './logger.ts'

createHoneycombApp(logger).mount('#honeycomb')
