<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Settings, SidecarWrite } from '../logic/settings.ts'

import { t } from '@nextcloud/l10n'
import { computed, onMounted, ref } from 'vue'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import WriteOnDialog from './WriteOnDialog.vue'
import { asksBeforeSidecarWrite } from '../logic/settings.ts'

const props = defineProps<{
	settings: Settings
	/** Whether the Versions app is enabled; On needs it (SETTINGS-001.26). */
	versionsApp: boolean
}>()

const emit = defineEmits<{
	/** A change of the settings; the app applies and saves it at once. */
	update: [patch: Partial<Settings>]
}>()

const versionsText = t('honeycomb', 'On needs the Versions app, so that every write can be undone; ask your administrator to enable it.')
const CHOICES = computed<readonly { mode: SidecarWrite, label: string, description: string, disabled: boolean }[]>(() => [
	{ mode: 'off', label: t('honeycomb', 'Off'), description: t('honeycomb', 'No file next to your photos is changed, and deciding asks to turn writing On first.'), disabled: false },
	{ mode: 'on', label: t('honeycomb', 'On'), description: props.versionsApp ? t('honeycomb', 'Each decision goes into the sidecars of the photo; a file without a sidecar gets a new one.') : versionsText, disabled: !props.versionsApp },
])

/** Whether the stored *Only existing sidecars* was read as Off; kept for this view while the hint is cleared (SETTINGS-001.26). */
const hinted = props.settings.sidecarExistingHint
onMounted(() => {
	if (hinted) {
		emit('update', { sidecarExistingHint: false })
	}
})

/** Whether the opt-in dialog is open, asking about On. */
const asking = ref(false)
/** The checked choice: On while the dialog asks about it, so a cancel checks the stored one again. */
const checked = computed<SidecarWrite>(() => (asking.value ? 'on' : props.settings.sidecarWrite))

/** Applies the choice, or asks first when it turns On. */
function choose(mode: SidecarWrite) {
	if (asksBeforeSidecarWrite(props.settings.sidecarWrite, mode)) {
		asking.value = true
		return
	}
	emit('update', { sidecarWrite: mode })
}

/** Turns On, as the dialog confirmed. */
function confirm() {
	asking.value = false
	emit('update', { sidecarWrite: 'on' })
}
</script>

<template>
	<p class="sidecar-settings__hint settings-text">
		{{ t('honeycomb', 'Your decisions always stay in honeycomb. Choose whether they also go into the XMP sidecars next to your photos, where digiKam, darktable and Lightroom read them.') }}
	</p>
	<NcNoteCard v-if="hinted" type="info" :text="t('honeycomb', 'Only existing sidecars is gone; writing is Off until you turn it On.')" />
	<fieldset class="sidecar-settings__choices" :aria-label="t('honeycomb', 'Write decisions to XMP sidecars')">
		<NcCheckboxRadioSwitch
			v-for="choice in CHOICES"
			:key="choice.mode"
			type="radio"
			name="sidecar-write"
			:value="choice.mode"
			:modelValue="checked"
			:description="choice.description"
			:disabled="choice.disabled"
			@update:modelValue="choose(choice.mode)">
			{{ choice.label }}
		</NcCheckboxRadioSwitch>
	</fieldset>
	<WriteOnDialog
		v-if="asking"
		turnsOn
		:sharedNames="[]"
		:versionsApp="props.versionsApp"
		@cancel="asking = false"
		@confirm="confirm" />
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
</style>
