<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Settings, SidecarWrite } from '../logic/settings.ts'

import { t } from '@nextcloud/l10n'
import { computed, ref } from 'vue'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import ConfirmDialog from './ConfirmDialog.vue'
import { asksBeforeSidecarWrite } from '../logic/settings.ts'

const props = defineProps<{
	settings: Settings
}>()

const emit = defineEmits<{
	/** A change of the settings; the app applies and saves it at once. */
	update: [patch: Partial<Settings>]
}>()

const CHOICES: readonly { mode: SidecarWrite, label: string, description: string }[] = [
	{ mode: 'off', label: t('honeycomb', 'Off'), description: t('honeycomb', 'No file next to your photos is changed.') },
	{ mode: 'existing', label: t('honeycomb', 'Only existing sidecars'), description: t('honeycomb', 'Sidecars another program already wrote get your decisions; no new file is created.') },
	{ mode: 'existing-and-new', label: t('honeycomb', 'Existing and new sidecars'), description: t('honeycomb', 'Each file without a sidecar also gets a new one.') },
]

/** The choice waiting for the opt-in dialog's answer. */
const asking = ref<SidecarWrite | null>(null)
/** The checked choice: the one asked about while the dialog is open, so a cancel checks the stored one again. */
const checked = computed(() => asking.value ?? props.settings.sidecarWrite)

/** Applies the choice, or asks first when it leaves off. */
function choose(mode: SidecarWrite) {
	if (asksBeforeSidecarWrite(props.settings.sidecarWrite, mode)) {
		asking.value = mode
		return
	}
	emit('update', { sidecarWrite: mode })
}

/** Applies the choice the dialog asked about. */
function confirm() {
	const mode = asking.value
	asking.value = null
	if (mode !== null) {
		emit('update', { sidecarWrite: mode })
	}
}
</script>

<template>
	<p class="sidecar-settings__hint settings-text">
		{{ t('honeycomb', 'Your decisions always stay in honeycomb. Choose whether they also go into the XMP sidecars next to your photos, where digiKam, darktable and Lightroom read them.') }}
	</p>
	<fieldset class="sidecar-settings__choices" :aria-label="t('honeycomb', 'Write decisions to XMP sidecars')">
		<NcCheckboxRadioSwitch
			v-for="choice in CHOICES"
			:key="choice.mode"
			type="radio"
			name="sidecar-write"
			:value="choice.mode"
			:modelValue="checked"
			:description="choice.description"
			@update:modelValue="choose(choice.mode)">
			{{ choice.label }}
		</NcCheckboxRadioSwitch>
	</fieldset>
	<ConfirmDialog
		v-if="asking !== null"
		:title="t('honeycomb', 'Write decisions to XMP sidecars?')"
		:confirmLabel="t('honeycomb', 'Write to sidecars')"
		cancel
		@cancel="asking = null"
		@confirm="confirm">
		<p class="sidecar-settings__intro">
			{{ t('honeycomb', 'From now on every rating, flag, colour label, Keep RAW and tag you set is written to the XMP sidecars of the photo, so digiKam, darktable and Lightroom see it.') }}
			<template v-if="asking === 'existing-and-new'">
				{{ t('honeycomb', 'A file without a sidecar gets a new one, such as {name}.', { name: 'IMG_0001.NEF.xmp' }) }}
			</template>
		</p>
		<NcNoteCard type="warning" :text="t('honeycomb', 'honeycomb keeps what other programs stored in a sidecar, but they may notice that it changed. Each write is a new version of the file and is synced to your devices.')" />
		<p class="sidecar-settings__hint">
			{{ t('honeycomb', 'In a shared folder honeycomb writes only when you ask, from the ⋯ menu.') }}
		</p>
	</ConfirmDialog>
</template>

<style scoped src="./settings-text.css" />

<style scoped>
.sidecar-settings__hint {
	color: var(--color-text-maxcontrast);
}

.sidecar-settings__choices {
	border: 0;
	padding: 0;
}

.sidecar-settings__intro {
	margin-top: 0;
}
</style>
