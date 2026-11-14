<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'
import { keyCap } from '../hotkeys.ts'
import { tip } from '../tooltip.ts'

const props = defineProps<{
	/** Where it goes back to, e.g. "Back to the series". */
	label: string
}>()

const emit = defineEmits<{ back: [] }>()
</script>

<template>
	<NcButton
		class="back-button"
		variant="tertiary"
		:aria-label="props.label"
		v-bind="tip(props.label, keyCap('close'))"
		@click="emit('back')">
		<template #icon>
			<AppIcon name="back" />
		</template>
		<span class="back-button__text">{{ props.label }}</span>
	</NcButton>
</template>

<style scoped>
/* A phone either way round shows the arrow only, as in the grid sizing rule's PHONE_SIDE. */
@media (max-width: 520px), (max-height: 520px) {
	.back-button__text {
		display: none;
	}
}
</style>
