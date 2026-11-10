<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Flag } from '../logic/decision.ts'
import type { SwipeDirection } from '../logic/loupe-gesture.ts'
import type { FolderMode } from '../logic/pairing.ts'
import type { ExtensionList, ExtensionRefusal, Settings } from '../logic/settings.ts'

import { t } from '@nextcloud/l10n'
import { reactive } from 'vue'
import NcAppSettingsDialog from '@nextcloud/vue/components/NcAppSettingsDialog'
import NcAppSettingsSection from '@nextcloud/vue/components/NcAppSettingsSection'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import AppIcon from './AppIcon.vue'
import MoveSettings from './MoveSettings.vue'
import { addExtension, DEFAULT_SUBFOLDERS, folderMode, removeExtension } from '../logic/settings.ts'

const props = defineProps<{
	open: boolean
	settings: Settings
}>()

const emit = defineEmits<{
	'update:open': [open: boolean]
	/** A change of the settings; the app applies and saves it at once. */
	update: [patch: Partial<Settings>]
}>()

const LISTS = [
	{ list: 'rawExtensions', label: t('honeycomb', 'RAW extensions') },
	{ list: 'renderedExtensions', label: t('honeycomb', 'Rendered extensions') },
] as const

const SWIPES = [
	{ direction: 'up', label: t('honeycomb', 'Swipe up') },
	{ direction: 'down', label: t('honeycomb', 'Swipe down') },
] as const

const SWITCHES = {
	singles: { key: 'showSingles', label: t('honeycomb', 'Show singles'), description: t('honeycomb', 'JPEG-only and RAW-only files stay in the grid') },
	autoAdvance: { key: 'autoAdvance', label: t('honeycomb', 'Auto-advance to the next undecided photo'), description: t('honeycomb', 'After pick or reject, not after rating or colour label') },
	flagButtons: { key: 'flagButtonsShown', label: t('honeycomb', 'Show flag buttons'), description: t('honeycomb', 'Pick, Reject and Unflag in the loupe and the series viewer. Hidden, the photo gets their room; keys, swipes and tooltips keep working, and the flag in the title row shows them again.') },
	viKeys: { key: 'viKeys', label: t('honeycomb', 'Vi keys'), description: t('honeycomb', 'h j k l switch photos, g g and Shift + G go to the first and last, / opens the filters. g no longer opens the grid: Esc does.') },
} as const

const drafts = reactive<Record<ExtensionList, string>>({ rawExtensions: '', renderedExtensions: '' })
const errors = reactive<Record<ExtensionList, string | null>>({ rawExtensions: null, renderedExtensions: null })

/** An extension as the chips show it. */
const shown = (extension: string) => extension.toUpperCase()

/** Why an extension was not added, in the user's words. */
function refusalText(refusal: ExtensionRefusal, input: string): string {
	const extension = `.${shown(input.trim().replace(/^\./, ''))}`
	switch (refusal) {
		case 'empty': return t('honeycomb', 'Type an extension.')
		case 'sidecar': return t('honeycomb', 'Sidecars are paired with their photo, they cannot be a photo type.')
		case 'invalid': return t('honeycomb', 'An extension has only letters and digits.')
		case 'in-this-list': return t('honeycomb', '{extension} is already in this list.', { extension })
		case 'in-other-list': return t('honeycomb', '{extension} is already in the other list.', { extension })
	}
}

/** Adds the typed extension to the list, or says why it cannot. */
function add(list: ExtensionList) {
	const result = addExtension(props.settings, list, drafts[list])
	if ('refused' in result) {
		errors[list] = refusalText(result.refused, drafts[list])
		return
	}
	errors[list] = null
	drafts[list] = ''
	emit('update', { [list]: result.settings[list] })
}

/** Removes the extension from the list. */
function remove(list: ExtensionList, extension: string) {
	emit('update', { [list]: removeExtension(props.settings, list, extension)[list] })
}

/** The subfolder names in use, the defaults while the files share a folder. */
function subfolders(mode: FolderMode): { rawSubfolder: string, renderedSubfolder: string } {
	return mode.kind === 'separate-subfolders' ? mode : DEFAULT_SUBFOLDERS
}

/** Sets the folder mode, the subfolder names as given. */
function setFolderMode(kind: FolderMode['kind'], names = subfolders(props.settings.folderMode)) {
	emit('update', { folderMode: folderMode(kind, names.rawSubfolder, names.renderedSubfolder) })
}

/** Renames one subfolder; an empty name takes its default. */
function rename(field: 'rawSubfolder' | 'renderedSubfolder', name: string) {
	setFolderMode('separate-subfolders', { ...subfolders(props.settings.folderMode), [field]: name })
}

/** Sets what the swipe in `direction` does; an empty value is Nothing. */
function setSwipe(direction: SwipeDirection, value: string) {
	emit('update', { swipes: { ...props.settings.swipes, [direction]: value === '' ? null : value as Flag } })
}
</script>

<template>
	<NcAppSettingsDialog
		:open="open"
		:name="t('honeycomb', 'Settings')"
		showNavigation
		noVersion
		@update:open="emit('update:open', $event)">
		<NcAppSettingsSection id="file-types" :name="t('honeycomb', 'File types')">
			<p class="settings-dialog__hint">
				{{ t('honeycomb', 'Per user. Files are paired by name, ignoring case.') }}
			</p>
			<div
				v-for="{ list, label } in LISTS"
				:key="list"
				role="group"
				class="settings-dialog__list"
				:aria-label="label">
				<b>{{ label }}</b>
				<div class="settings-dialog__chips">
					<span v-for="extension in settings[list]" :key="extension" class="settings-dialog__extension">
						.{{ shown(extension) }}
						<NcButton
							variant="tertiary-no-background"
							size="small"
							:aria-label="t('honeycomb', 'Remove {name}', { name: shown(extension) })"
							:disabled="settings[list].length === 1"
							@click="remove(list, extension)">
							<template #icon>
								<AppIcon name="close" />
							</template>
						</NcButton>
					</span>
					<form class="settings-dialog__add" @submit.prevent="add(list)">
						<input
							v-model="drafts[list]"
							type="text"
							maxlength="10"
							autocapitalize="characters"
							:placeholder="t('honeycomb', 'add…')"
							:aria-label="t('honeycomb', 'Add extension')">
						<NcButton type="submit">
							{{ t('honeycomb', 'Add') }}
						</NcButton>
					</form>
				</div>
				<p v-if="errors[list] !== null" class="settings-dialog__error">
					{{ errors[list] }}
				</p>
			</div>
		</NcAppSettingsSection>
		<NcAppSettingsSection id="folder-layout" :name="t('honeycomb', 'Folder layout')">
			<fieldset class="settings-dialog__mode" :aria-label="t('honeycomb', 'Folder mode')">
				<NcCheckboxRadioSwitch
					type="radio"
					name="folder-mode"
					value="same-folder"
					:modelValue="settings.folderMode.kind"
					@update:modelValue="setFolderMode('same-folder')">
					{{ t('honeycomb', 'Same folder') }}
				</NcCheckboxRadioSwitch>
				<NcCheckboxRadioSwitch
					type="radio"
					name="folder-mode"
					value="separate-subfolders"
					:modelValue="settings.folderMode.kind"
					@update:modelValue="setFolderMode('separate-subfolders')">
					{{ t('honeycomb', 'Separate subfolders') }}
				</NcCheckboxRadioSwitch>
			</fieldset>
			<template v-if="settings.folderMode.kind === 'separate-subfolders'">
				<div class="settings-dialog__folders">
					<label>
						{{ t('honeycomb', 'RAW folder') }}
						<input
							type="text"
							:value="settings.folderMode.rawSubfolder"
							:aria-label="t('honeycomb', 'RAW folder')"
							@change="rename('rawSubfolder', ($event.target as HTMLInputElement).value)">
					</label>
					<label>
						{{ t('honeycomb', 'Rendered folder') }}
						<input
							type="text"
							:value="settings.folderMode.renderedSubfolder"
							:aria-label="t('honeycomb', 'Rendered folder')"
							@change="rename('renderedSubfolder', ($event.target as HTMLInputElement).value)">
					</label>
				</div>
				<p class="settings-dialog__hint">
					{{ t('honeycomb', 'Folder names are matched ignoring case.') }}
				</p>
			</template>
			<NcCheckboxRadioSwitch
				type="switch"
				:modelValue="settings.showSingles"
				:description="SWITCHES.singles.description"
				@update:modelValue="emit('update', { showSingles: $event })">
				{{ SWITCHES.singles.label }}
			</NcCheckboxRadioSwitch>
		</NcAppSettingsSection>
		<NcAppSettingsSection id="loupe-gestures" :name="t('honeycomb', 'Loupe gestures')">
			<p class="settings-dialog__hint">
				{{ t('honeycomb', 'A direction set to Nothing turns that swipe off.') }}
			</p>
			<label v-for="{ direction, label } in SWIPES" :key="direction" class="settings-dialog__swipe">
				<span>{{ label }}</span>
				<select
					:value="settings.swipes[direction] ?? ''"
					:aria-label="label"
					@change="setSwipe(direction, ($event.target as HTMLSelectElement).value)">
					<option value="picked">{{ t('honeycomb', 'Pick') }}</option>
					<option value="rejected">{{ t('honeycomb', 'Reject') }}</option>
					<option value="">{{ t('honeycomb', 'Nothing') }}</option>
				</select>
			</label>
			<NcCheckboxRadioSwitch
				v-for="item in [SWITCHES.autoAdvance, SWITCHES.flagButtons]"
				:key="item.key"
				type="switch"
				:modelValue="settings[item.key]"
				:description="item.description"
				@update:modelValue="emit('update', { [item.key]: $event })">
				{{ item.label }}
			</NcCheckboxRadioSwitch>
		</NcAppSettingsSection>
		<NcAppSettingsSection id="keyboard" :name="t('honeycomb', 'Keyboard')">
			<NcCheckboxRadioSwitch
				type="switch"
				:modelValue="settings.viKeys"
				:description="SWITCHES.viKeys.description"
				@update:modelValue="emit('update', { viKeys: $event })">
				{{ SWITCHES.viKeys.label }}
			</NcCheckboxRadioSwitch>
		</NcAppSettingsSection>
		<NcAppSettingsSection id="moving-photos" :name="t('honeycomb', 'Moving photos')">
			<MoveSettings :settings="settings" @update="emit('update', $event)" />
		</NcAppSettingsSection>
	</NcAppSettingsDialog>
</template>

<style scoped>
.settings-dialog__hint {
	color: var(--color-text-maxcontrast);
	margin-block-end: calc(2 * var(--default-grid-baseline));
}

.settings-dialog__list {
	margin-block-end: calc(3 * var(--default-grid-baseline));
}

.settings-dialog__chips,
.settings-dialog__add,
.settings-dialog__folders {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
	margin-block-start: calc(2 * var(--default-grid-baseline));
}

.settings-dialog__extension {
	display: inline-flex;
	align-items: center;
	padding-inline-start: calc(2 * var(--default-grid-baseline));
	border-radius: var(--border-radius-element);
	background: var(--color-background-dark);
	font-family: var(--font-face-monospace, monospace);
}

.settings-dialog__add input {
	width: 8em;
}

.settings-dialog__error {
	color: var(--color-text-error, var(--color-error));
	margin-block-start: var(--default-grid-baseline);
}

.settings-dialog__mode {
	display: flex;
	flex-wrap: wrap;
	gap: calc(2 * var(--default-grid-baseline));
	border: 0;
	padding: 0;
}

.settings-dialog__swipe {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: calc(2 * var(--default-grid-baseline));
	margin-block-end: calc(2 * var(--default-grid-baseline));
}
</style>
