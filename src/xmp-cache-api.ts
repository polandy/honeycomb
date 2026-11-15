// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { API } from './api.ts'

/** Clears the user's XMP cache and visual hashes; sidecars and decisions stay (ADR 0032). */
export async function clearCache(): Promise<void> {
	await axios.delete(generateUrl(`${API}/xmp-cache`))
}
