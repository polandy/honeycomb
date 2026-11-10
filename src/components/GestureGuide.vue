<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import { onMounted, useTemplateRef } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'
import { keyCap } from '../hotkeys.ts'

const emit = defineEmits<{
	dismiss: []
}>()

const KEYS = [
	{ caps: [keyCap('pick')], label: t('honeycomb', 'Pick') },
	{ caps: [keyCap('reject')], label: t('honeycomb', 'Reject') },
	{ caps: [keyCap('unflag')], label: t('honeycomb', 'Unflag') },
	{ caps: [keyCap('zoom', 1)], label: t('honeycomb', 'Zoom') },
	{ caps: [keyCap('shortcuts', 1)], label: t('honeycomb', 'All keys') },
]

const gotIt = useTemplateRef<InstanceType<typeof NcButton>>('gotIt')

onMounted(() => (gotIt.value!.$el as HTMLElement).focus())
</script>

<template>
	<div class="gesture-guide">
		<div class="gesture-guide__card" role="dialog" :aria-label="t('honeycomb', 'How to cull')">
			<h3>{{ t('honeycomb', 'How to cull') }}</h3>
			<ul>
				<li>{{ t('honeycomb', 'Swipe up to pick, down to reject') }}</li>
				<li>{{ t('honeycomb', 'Swipe sideways for the next or previous photo') }}</li>
				<li>
					{{ t('honeycomb', 'Tap the left or right side for the previous or next photo, the middle for the controls') }}
					<div class="gesture-guide__zones" aria-hidden="true">
						<span><AppIcon name="chevronLeft" /></span>
						<span>{{ t('honeycomb', 'Controls') }}</span>
						<span><AppIcon name="chevronRight" /></span>
					</div>
				</li>
				<li>{{ t('honeycomb', 'Pinch to zoom, double-tap to hide the controls') }}</li>
				<li>
					{{ t('honeycomb', 'Keys:') }}
					<span v-for="key in KEYS" :key="key.label" class="gesture-guide__key">
						<kbd v-for="cap in key.caps" :key="cap">{{ cap }}</kbd>
						{{ key.label }}
					</span>
				</li>
			</ul>
			<NcButton ref="gotIt" variant="primary" @click="emit('dismiss')">
				{{ t('honeycomb', 'Got it') }}
			</NcButton>
		</div>
	</div>
</template>

<style scoped>
.gesture-guide {
	position: absolute;
	z-index: 2;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: calc(4 * var(--default-grid-baseline));
	background-color: color-mix(in srgb, var(--color-main-background) 60%, transparent);
}

.gesture-guide__card {
	max-width: 380px;
	max-height: 100%;
	overflow: auto;
	padding: calc(4 * var(--default-grid-baseline)) calc(5 * var(--default-grid-baseline));
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-large);
	background-color: var(--color-main-background);
	box-shadow: 0 2px 8px var(--color-box-shadow);
}

.gesture-guide__card ul {
	margin-block-end: calc(4 * var(--default-grid-baseline));
	padding-inline-start: calc(4 * var(--default-grid-baseline));
	list-style: disc;
	line-height: 1.8;
}

.gesture-guide__zones {
	display: grid;
	grid-template-columns: 3fr 4fr 3fr;
	gap: 3px;
	font-size: var(--font-size-small, 12px);
	line-height: 1;
}

.gesture-guide__zones span {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 26px;
	border: 1px dashed var(--color-border-maxcontrast);
	border-radius: var(--border-radius);
}

.gesture-guide__key {
	margin-inline-start: 1ch;
	white-space: nowrap;
}

kbd {
	margin-inline-end: 0.5ch;

	padding: 0 var(--default-grid-baseline);
	border: 1px solid var(--color-border-dark);
	border-radius: var(--border-radius);
	font-family: inherit;
}
</style>
