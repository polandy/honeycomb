<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { RecentFolderSet } from '../logic/recent.ts'
import type { ResumePosition } from '../logic/resume-position.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, ref } from 'vue'
import { decidedText } from '../cull/decision-text.ts'
import { folderSetName } from '../folders/recent-text.ts'
import { formatNumber } from '../shared/l10n.ts'
import { tip } from '../shared/tooltip.ts'

const props = defineProps<{
	items: readonly RecentFolderSet[]
}>()

const emit = defineEmits<{
	open: [position: ResumePosition]
}>()

/** How many folder sets show before *Show all*. */
const COLLAPSED_ROWS = 3

const expanded = ref(false)
const shown = computed(() => (expanded.value ? props.items : props.items.slice(0, COLLAPSED_ROWS)))
const showAllLabel = computed(() => n('honeycomb', 'Show all {count}', 'Show all {count}', props.items.length, { count: formatNumber(props.items.length) }))
</script>

<template>
	<div class="picker-recent-sets">
		<button
			v-for="item in shown"
			:key="item.position.folderSet.paths.join('\n') + item.position.folderSet.subfolders"
			type="button"
			class="picker-recent-sets__row"
			:class="{ 'picker-recent-sets__row--current': item.current }"
			:aria-current="item.current ? 'true' : undefined"
			v-bind="tip(item.position.folderSet.paths.join(', '))"
			@click="emit('open', item.position)">
			<span class="picker-recent-sets__name">{{ folderSetName(item.position.folderSet) }}</span>
			<span class="picker-recent-sets__progress">{{ decidedText(item.decided, item.total) }}</span>
		</button>
		<button
			v-if="props.items.length > COLLAPSED_ROWS"
			type="button"
			class="picker-recent-sets__toggle"
			:aria-expanded="expanded"
			@click="expanded = !expanded">
			{{ expanded ? t('honeycomb', 'Show fewer') : showAllLabel }}
		</button>
	</div>
</template>

<style scoped>
.picker-recent-sets {
	display: flex;
	flex-direction: column;
}

.picker-recent-sets__row,
.picker-recent-sets__toggle {
	display: flex;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
	min-height: 44px;
	padding: 0 calc(2 * var(--default-grid-baseline));
	border: 0;
	border-radius: var(--border-radius-element);
	background: transparent;
	color: var(--color-main-text);
	font: inherit;
	text-align: start;
	cursor: pointer;
}

.picker-recent-sets__row:hover,
.picker-recent-sets__toggle:hover {
	background: var(--color-background-hover);
}

.picker-recent-sets__row--current {
	background: var(--color-primary-element-light);
}

.picker-recent-sets__name {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.picker-recent-sets__progress,
.picker-recent-sets__toggle {
	color: var(--color-text-maxcontrast);
	font-size: var(--font-size-small, 0.875em);
}

.picker-recent-sets__progress {
	flex: none;
	white-space: nowrap;
}

/* A dialog without the height keeps the rows compact. */
@media (max-height: 640px) {
	.picker-recent-sets__row,
	.picker-recent-sets__toggle {
		min-height: 36px;
	}
}
</style>
