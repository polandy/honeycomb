<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Settings } from '../logic/settings.ts'

import { t } from '@nextcloud/l10n'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'

defineProps<{
	settings: Settings
}>()

const emit = defineEmits<{
	/** A change of the settings; the app applies and saves it at once. */
	update: [patch: Partial<Settings>]
}>()
</script>

<template>
	<NcCheckboxRadioSwitch
		type="switch"
		:modelValue="settings.keepStatistics"
		:description="t('honeycomb', 'Counts what honeycomb does per day: photos decided, moved to the trash bin, sidecars written. No file names, nothing leaves your Nextcloud.')"
		@update:modelValue="emit('update', { keepStatistics: $event })">
		{{ t('honeycomb', 'Keep statistics') }}
	</NcCheckboxRadioSwitch>
</template>
