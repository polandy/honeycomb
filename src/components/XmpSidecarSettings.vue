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
		:modelValue="settings.writeFlagsToXmp"
		:description="t('honeycomb', 'digiKam sees them at once, and a pick or reject changed in digiKam is taken over on the next visit. Stars, colour labels and tags are written either way.')"
		@update:modelValue="emit('update', { writeFlagsToXmp: $event })">
		{{ t('honeycomb', 'Write picks, rejects and Keep RAW to XMP sidecars') }}
	</NcCheckboxRadioSwitch>
</template>
