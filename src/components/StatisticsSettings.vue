<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Settings } from '../logic/settings.ts'

import { t } from '@nextcloud/l10n'
import { ref } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import ConfirmDialog from './ConfirmDialog.vue'

defineProps<{
	settings: Settings
}>()

const emit = defineEmits<{
	/** A change of the settings; the app applies and saves it at once. */
	update: [patch: Partial<Settings>]
	/** The user confirmed that every counter goes (STATS-001.3). */
	reset: []
}>()

const asking = ref(false)

/** Closes the question and resets. */
function confirm(): void {
	asking.value = false
	emit('reset')
}
</script>

<template>
	<NcCheckboxRadioSwitch
		type="switch"
		:modelValue="settings.keepStatistics"
		:description="t('honeycomb', 'Counts what honeycomb does per day: pictures decided, moved to the trash bin, sidecars written. No file names, nothing leaves your Nextcloud.')"
		@update:modelValue="emit('update', { keepStatistics: $event })">
		{{ t('honeycomb', 'Keep statistics') }}
	</NcCheckboxRadioSwitch>
	<NcButton @click="asking = true">
		{{ t('honeycomb', 'Reset statistics') }}
	</NcButton>
	<ConfirmDialog
		v-if="asking"
		:title="t('honeycomb', 'Reset all statistics?')"
		:confirmLabel="t('honeycomb', 'Reset statistics')"
		cancel
		danger
		focusCancel
		@cancel="asking = false"
		@confirm="confirm">
		<p>{{ t('honeycomb', 'Every counter goes and counting starts again today. Your photos and sidecars stay as they are.') }}</p>
	</ConfirmDialog>
</template>
