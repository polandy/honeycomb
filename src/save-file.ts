// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The JSON media type the saved file is offered as. */
const JSON_TYPE = 'application/json'

/** Offers `text` to the browser as a download named `name`. */
export function saveBrowserFile(name: string, text: string): void {
	const url = URL.createObjectURL(new Blob([text], { type: JSON_TYPE }))
	const link = document.createElement('a')
	link.href = url
	link.download = name
	link.click()
	URL.revokeObjectURL(url)
}
