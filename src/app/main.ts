import { optInToEdgeToEdge } from '../shared/edge-to-edge.ts'
import { logger } from '../shared/logger.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHoneycombApp } from './create-honeycomb-app.ts'

optInToEdgeToEdge(document)

createHoneycombApp(logger).mount('#honeycomb')
