// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Prefix the stub catalogue puts before every translated string. */
export const TRANSLATED_MARK = '[de] '

// Props of stubbed components render as attributes, so their names join the default ones of vue/no-bare-strings-in-template.
const USER_VISIBLE_ATTRIBUTES = ['alt', 'aria-label', 'aria-placeholder', 'aria-roledescription', 'aria-valuetext', 'placeholder', 'title', 'name', 'description', 'label', 'text']
const PLURAL_KEY = /^_(.*)_::_(.*)_$/s

type Registry = Record<string, unknown>
const registry = globalThis as unknown as { _oc_l10n_registry_translations: Registry, _oc_l10n_registry_plural_functions: Registry }

/** Translates every honeycomb string, known or not, into a marked stand-in for German (ADR 0007). */
export function installMarkedCatalogue(): void {
	registry._oc_l10n_registry_translations ??= {}
	registry._oc_l10n_registry_plural_functions ??= {}
	registry._oc_l10n_registry_translations.honeycomb = new Proxy({}, {
		get: (_target, key) => {
			if (typeof key !== 'string') {
				return undefined
			}
			const plural = PLURAL_KEY.exec(key)
			return plural ? plural.slice(1).map((form) => TRANSLATED_MARK + form) : TRANSLATED_MARK + key
		},
	})
	registry._oc_l10n_registry_plural_functions.honeycomb = (count: number) => (count === 1 ? 0 : 1)
}

/** Removes the marked catalogue again. */
export function uninstallMarkedCatalogue(): void {
	delete registry._oc_l10n_registry_translations.honeycomb
	delete registry._oc_l10n_registry_plural_functions.honeycomb
}

/** Lists the rendered text and user-visible attribute values that did not go through the catalogue. */
export function untranslatedText(root: Element): string[] {
	const found: string[] = []
	const check = (value: string | null) => {
		const text = value?.trim() ?? ''
		if (/\p{L}/u.test(text) && !text.startsWith(TRANSLATED_MARK.trim())) {
			found.push(text)
		}
	}
	for (const element of [root, ...root.querySelectorAll('*')]) {
		// A form control's name is its key in the form, never shown.
		const shown = element.tagName === 'INPUT' ? USER_VISIBLE_ATTRIBUTES.filter((attribute) => attribute !== 'name') : USER_VISIBLE_ATTRIBUTES
		shown.forEach((attribute) => check(element.getAttribute(attribute)))
		element.childNodes.forEach((node) => node.nodeType === node.TEXT_NODE && check(node.textContent))
	}
	return found
}
