<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { NameTemplatePreset } from '../logic/name-template/presets.ts'
import type { PreviewRow } from '../logic/name-template/preview.ts'
import type { Settings } from '../logic/settings.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, ref, watch } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import AppIcon from './AppIcon.vue'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { folderName, toggleFavourite } from '../logic/move-targets.ts'
import { NAME_TEMPLATE_PRESETS, presetOf } from '../logic/name-template/presets.ts'
import { templatePreview } from '../logic/name-template/preview.ts'
import { namingProblemText } from '../move-text.ts'
import { templateProblemText } from '../name-template-text.ts'
import { tip } from '../tooltip.ts'

const props = defineProps<{
	settings: Settings
}>()

const emit = defineEmits<{
	/** A change of the settings; the app applies and saves it at once. */
	update: [patch: Partial<Settings>]
}>()

const PRESET_LABELS: Record<NameTemplatePreset, string> = {
	'by-day': t('honeycomb', 'By day'),
	'by-day-full-date': t('honeycomb', 'By day, full date in the name'),
	'keep-names': t('honeycomb', 'Keep names'),
}

const draft = ref<string | null>(null)
const shown = computed(() => draft.value ?? props.settings.moveTemplate)
const preview = computed(() => templatePreview(shown.value))
const caret = computed(() => (preview.value.ok ? '' : `${' '.repeat(preview.value.column - 1)}^ ${templateProblemText(shown.value, preview.value.problem, preview.value.column)}`))

watch(() => props.settings.moveTemplate, () => {
	draft.value = null
})

/** Sets the preset's template and drops the typed one. */
function choose(template: string) {
	draft.value = null
	emit('update', { moveTemplate: template })
}

/** Keeps the typed template and saves it once it is valid. */
function type(text: string) {
	draft.value = text
	if (preview.value.ok && text !== props.settings.moveTemplate) {
		emit('update', { moveTemplate: text })
	}
}

/** The sample's original files, as `DSCF1234.JPG + .RAF`. */
const originals = ({ sample }: PreviewRow) => `${sample.facts.baseName}.${sample.files.map((file) => file.extension).join(' + .')}`

/** The notes on a preview row: a collision suffix, a file time, an unknown camera. */
function notes(row: PreviewRow): string[] {
	return [
		...(row.suffix === null ? [] : [t('honeycomb', 'collision: -{n} added', { n: row.suffix })]),
		...(row.fileTime ? [t('honeycomb', 'no EXIF time: file time')] : []),
		...(row.unknownCamera ? [t('honeycomb', 'no camera model: unknown')] : []),
	]
}

/** How many samples get a suffix, or that every name is unique. */
function summary(collisions: number): string {
	return collisions === 0
		? t('honeycomb', 'All 5 sample photos get unique names, even the two cameras that shot at the same second.')
		: n('honeycomb', '{count} of 5 sample photos collides with another one and gets a -2, -3 suffix. Add {camera} and the time to the name to keep names unique.', '{count} of 5 sample photos collide with another one and get a -2, -3 suffix. Add {camera} and the time to the name to keep names unique.', collisions, { count: formatNumber(collisions), camera: '{camera}' }, PLAIN_TEXT)
}
</script>

<template>
	<div class="move-settings">
		<p class="move-settings__hint settings-text">
			{{ t('honeycomb', 'Name template for moved photos, relative to the chosen folder. All files of a photo, sidecars included, get the same new name.') }}
		</p>
		<fieldset class="move-settings__presets" :aria-label="t('honeycomb', 'Template preset')">
			<NcCheckboxRadioSwitch
				v-for="{ preset, template } in NAME_TEMPLATE_PRESETS"
				:key="preset"
				type="radio"
				name="name-template-preset"
				:value="preset"
				:modelValue="presetOf(shown) ?? ''"
				@update:modelValue="choose(template)">
				{{ PRESET_LABELS[preset] }}
			</NcCheckboxRadioSwitch>
		</fieldset>
		<input
			class="move-settings__template"
			type="text"
			maxlength="255"
			spellcheck="false"
			autocapitalize="off"
			autocomplete="off"
			:value="shown"
			:aria-label="t('honeycomb', 'Name template')"
			@input="type(($event.target as HTMLInputElement).value)">
		<template v-if="!preview.ok">
			<pre class="move-settings__problem" role="alert">{{ shown }}
{{ caret }}</pre>
			<p class="move-settings__unsaved settings-text">
				{{ t('honeycomb', 'Not saved: moving keeps using the last valid template.') }}
			</p>
		</template>
		<template v-else>
			<ul class="move-settings__preview" :aria-label="t('honeycomb', 'Preview with five sample photos')">
				<li v-for="(row, index) in preview.rows" :key="index">
					<span class="move-settings__sample">
						<span translate="no">{{ originals(row) }}</span> ·
						<span v-if="row.sample.facts.model !== null" translate="no">{{ row.sample.facts.model }}</span>
						<span v-else>{{ t('honeycomb', 'no EXIF') }}</span>
					</span>
					<code v-for="path in row.paths ?? []" :key="path" translate="no">{{ ` ${path}` }}</code>
					<span v-if="row.paths === null" class="move-settings__bad">{{ ` ${namingProblemText('no-number')}` }}</span>
					<span v-for="note in notes(row)" :key="note" class="move-settings__note">{{ ` ${note}` }}</span>
				</li>
			</ul>
			<p class="move-settings__summary settings-text" :class="{ 'move-settings__summary--warning': preview.collisions > 0 }">
				{{ summary(preview.collisions) }}
			</p>
		</template>
		<p class="move-settings__hint settings-text">
			{{ t('honeycomb', 'Tokens: {tokens}; :lower and :upper on text tokens. Only letters, digits, . _ - and /, never spaces.', { tokens: '{date:%Y %m %d %j %H %M %S}, {camera}, {make}, {name}, {number:N}, {ext}' }, undefined, PLAIN_TEXT) }}
		</p>
		<b class="settings-text">{{ t('honeycomb', 'Favourite folders') }}</b>
		<div class="move-settings__favourites">
			<span v-for="path in settings.moveFavourites" :key="path" class="move-settings__favourite">
				<span translate="no">{{ `★ ${folderName(path)}` }}</span>
				<NcButton
					variant="tertiary-no-background"
					size="small"
					:aria-label="t('honeycomb', 'Remove favourite {path}', { path }, undefined, PLAIN_TEXT)"
					v-bind="tip(t('honeycomb', 'Remove favourite {path}', { path }, undefined, PLAIN_TEXT))"
					@click="emit('update', { moveFavourites: toggleFavourite(settings.moveFavourites, path) })">
					<template #icon>
						<AppIcon name="close" />
					</template>
				</NcButton>
			</span>
			<span v-if="settings.moveFavourites.length === 0" class="move-settings__hint">
				{{ t('honeycomb', 'None yet: add one in the move dialog.') }}
			</span>
		</div>
	</div>
</template>

<style scoped src="./settings-text.css" />

<style scoped>
.move-settings__hint {
	color: var(--color-text-maxcontrast);
	margin-block: calc(2 * var(--default-grid-baseline));
}

.move-settings__presets {
	display: flex;
	flex-wrap: wrap;
	gap: calc(2 * var(--default-grid-baseline));
	border: 0;
	padding: 0;
}

.move-settings__template {
	width: 100%;
	font-family: var(--font-face-monospace, monospace);
}

.move-settings__problem {
	overflow-x: auto;
	margin: 0;
	padding: calc(2 * var(--default-grid-baseline));
	border-radius: var(--border-radius-element);
	background: var(--color-warning);
	color: var(--color-warning-text, var(--color-main-text));
	font-family: var(--font-face-monospace, monospace);
	white-space: pre;
}

.move-settings__unsaved,
.move-settings__summary {
	margin-block: var(--default-grid-baseline) calc(2 * var(--default-grid-baseline));
	color: var(--color-text-maxcontrast);
}

.move-settings__summary--warning {
	color: var(--color-warning-text, var(--color-warning));
}

.move-settings__preview {
	margin: calc(2 * var(--default-grid-baseline)) 0 0;
	padding: 0;
	list-style: none;
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-element);
}

.move-settings__preview li {
	padding: var(--default-grid-baseline) calc(2 * var(--default-grid-baseline));
	border-block-end: 1px solid var(--color-border);
	overflow-wrap: anywhere;
}

.move-settings__preview li:last-child {
	border-block-end: 0;
}

.move-settings__preview li > * {
	display: block;
	width: fit-content;
}

.move-settings__sample {
	color: var(--color-text-maxcontrast);
}

.move-settings__bad {
	color: var(--color-text-error, var(--color-error));
}

.move-settings__note {
	padding-inline: var(--default-grid-baseline);
	border-radius: var(--border-radius-element);
	background: var(--color-background-dark);
	font-size: 0.9em;
}

.move-settings__favourites {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
	margin-block-start: calc(2 * var(--default-grid-baseline));
}

.move-settings__favourite {
	display: inline-flex;
	align-items: center;
	padding-inline-start: calc(2 * var(--default-grid-baseline));
	border-radius: var(--border-radius-element);
	background: var(--color-background-dark);
}
</style>
