<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'
import { keyCap } from '../hotkeys.ts'
import { tip } from '../tooltip.ts'

const props = defineProps<{
	/** Secondary beside the active picture's primary one. */
	secondary?: boolean
}>()

const emit = defineEmits<{ pick: [] }>()
</script>

<template>
	<NcButton
		class="pick-rest-button"
		:variant="props.secondary ? 'secondary' : 'primary'"
		wide
		v-bind="tip(t('honeycomb', 'Pick this, reject the rest'), keyCap('pick-rest'))"
		@click="emit('pick')">
		<template #icon>
			<AppIcon name="flagPick" />
		</template>
		{{ t('honeycomb', 'Pick this, reject the rest') }}
	</NcButton>
</template>
