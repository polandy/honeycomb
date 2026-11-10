<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
	/** The shown picture's index. */
	index: number
	count: number
}>()

const emit = defineEmits<{ page: [step: -1 | 1] }>()

const navigation = computed(() => [
	{ step: -1, shown: props.index > 0, icon: 'chevronLeft', label: t('honeycomb', 'Previous photo') },
	{ step: 1, shown: props.index < props.count - 1, icon: 'chevronRight', label: t('honeycomb', 'Next photo') },
] as const)
</script>

<template>
	<div class="loupe-nav-buttons">
		<template v-for="nav in navigation" :key="nav.step">
			<NcButton
				v-if="nav.shown"
				class="loupe-nav-buttons__button"
				:class="`loupe-nav-buttons__button--${nav.step < 0 ? 'previous' : 'next'}`"
				variant="tertiary"
				:aria-label="nav.label"
				@click="emit('page', nav.step)">
				<template #icon>
					<AppIcon :name="nav.icon" />
				</template>
			</NcButton>
		</template>
	</div>
</template>

<style scoped>
.loupe-nav-buttons {
	position: absolute;
	inset: 0;
	pointer-events: none;
}

.loupe-nav-buttons__button {
	position: absolute;
	top: 50%;
	transform: translateY(-50%);
	pointer-events: auto;
}

.loupe-nav-buttons__button--previous {
	inset-inline-start: calc(var(--photo-loupe-rail, 0px) + var(--default-grid-baseline));
}

.loupe-nav-buttons__button--next {
	inset-inline-end: calc(var(--photo-loupe-panel, 0px) + var(--photo-loupe-rail, 0px) + var(--default-grid-baseline));
}
</style>
