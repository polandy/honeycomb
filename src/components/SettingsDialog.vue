<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderMode } from '../logic/pairing.ts'
import type { ExtensionList, ExtensionRefusal, Settings } from '../logic/settings.ts'

import { t } from '@nextcloud/l10n'
import { reactive } from 'vue'
import NcAppSettingsDialog from '@nextcloud/vue/components/NcAppSettingsDialog'
import NcAppSettingsSection from '@nextcloud/vue/components/NcAppSettingsSection'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import AppIcon from './AppIcon.vue'
import LoupeGestureSettings from './LoupeGestureSettings.vue'
import MoveSettings from './MoveSettings.vue'
import { addExtension, DEFAULT_SUBFOLDERS, folderMode, removeExtension } from '../logic/settings.ts'
import { tip } from '../tooltip.ts'

const props = defineProps<{
	open: boolean
	settings: Settings
	/** Whether the gesture guide counts as seen, which its hint tells. */
	gestureGuideSeen: boolean
}>()

const emit = defineEmits<{
	'update:open': [open: boolean]
	/** A change of the settings; the app applies and saves it at once. */
	update: [patch: Partial<Settings>]
	/** The user wants the gesture guide on the next loupe opening. */
	showGestureGuide: []
}>()

const LISTS = [
	{ list: 'rawExtensions', label: t('honeycomb', 'RAW extensions') },
	{ list: 'renderedExtensions', label: t('honeycomb', 'Rendered extensions') },
] as const

const SWITCHES = {
	singles: { key: 'showSingles', label: t('honeycomb', 'Show singles'), description: t('honeycomb', 'JPEG-only and RAW-only files stay in the grid') },
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
</script>

<template>
	<NcAppSettingsDialog
		:open="open"
		:name="t('honeycomb', 'Settings')"
		showNavigation
		noVersion
		@update:open="emit('update:open', $event)">
		<NcAppSettingsSection id="file-types" :name="t('honeycomb', 'File types')">
			<p class="settings-dialog__hint settings-text">
				{{ t('honeycomb', 'Per user. Files are paired by name, ignoring case.') }}
			</p>
			<div
				v-for="{ list, label } in LISTS"
				:key="list"
				role="group"
				class="settings-dialog__list"
				:aria-label="label">
				<b class="settings-text">{{ label }}</b>
				<div class="settings-dialog__chips">
					<span v-for="extension in settings[list]" :key="extension" class="settings-dialog__extension">
						.{{ shown(extension) }}
						<NcButton
							variant="tertiary-no-background"
							size="small"
							:aria-label="t('honeycomb', 'Remove {name}', { name: shown(extension) })"
							v-bind="tip(t('honeycomb', 'Remove {name}', { name: shown(extension) }))"
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
				<p v-if="errors[list] !== null" class="settings-dialog__error settings-text">
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
				<div class="settings-dialog__folders settings-text">
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
				<p class="settings-dialog__hint settings-text">
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
			<LoupeGestureSettings
				:settings="settings"
				:gestureGuideSeen="gestureGuideSeen"
				@update="emit('update', $event)"
				@showGestureGuide="emit('showGestureGuide')" />
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

<style scoped src="./settings-text.css" />

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
</style>
