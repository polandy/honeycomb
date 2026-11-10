// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The template a move uses until the user sets one (`docs/plan.md` Moving pictures). */
export const DEFAULT_NAME_TEMPLATE = '{date:%Y}/{date:%Y-%m-%d}/{date:%H%M%S}_{camera}_{name}.{ext}'

/** A preset of the name template setting; the settings word it. */
export type NameTemplatePreset = 'by-day' | 'by-day-full-date' | 'keep-names'

/** The presets in the order the settings offer them (`docs/05-name-templates.md` Default and presets). */
export const NAME_TEMPLATE_PRESETS: readonly { readonly preset: NameTemplatePreset, readonly template: string }[] = [
	{ preset: 'by-day', template: DEFAULT_NAME_TEMPLATE },
	{ preset: 'by-day-full-date', template: '{date:%Y}/{date:%Y-%m-%d}/{date:%Y%m%d-%H%M%S}_{camera}_{name}.{ext}' },
	{ preset: 'keep-names', template: '{name}.{ext}' },
]

/** The preset whose template this is, or null for the user's own. */
export function presetOf(template: string): NameTemplatePreset | null {
	return NAME_TEMPLATE_PRESETS.find((each) => each.template === template)?.preset ?? null
}
