// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from 'vitest/config'

// The XMP round trip needs exiftool and exiv2; scripts/xmp-interop.sh runs it in a container with both.
export default defineConfig({
	test: {
		include: ['tests/interop/**/*.test.ts'],
		restoreMocks: true,
	},
})
