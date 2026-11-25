<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'

/** The parts of a row's bar, in its order (FOLDERS-007.20). */
const PARTS = [
	{ kind: 'picked', label: () => t('honeycomb', 'Picked') },
	{ kind: 'undecided', label: () => t('honeycomb', 'Undecided') },
	{ kind: 'rejected', label: () => t('honeycomb', 'Rejected') },
] as const
</script>

<template>
	<ul class="folder-split-legend" :aria-label="t('honeycomb', 'Colours of the bar')">
		<li v-for="part in PARTS" :key="part.kind" class="folder-split-legend__part">
			<span class="folder-split-legend__swatch" :class="`folder-row__split-${part.kind}`" />
			{{ part.label() }}
		</li>
	</ul>
</template>

<style scoped src="./folder-row.css" />

<style scoped>
.folder-split-legend {
	display: flex;
	flex-wrap: wrap;
	gap: var(--default-grid-baseline) calc(3 * var(--default-grid-baseline));
	margin: 0;
	padding: 0;
	color: var(--color-text-maxcontrast);
	font-size: 13px;
	list-style: none;
}

.folder-split-legend__part {
	display: flex;
	align-items: center;
	gap: calc(1.5 * var(--default-grid-baseline));
}

.folder-split-legend__swatch {
	width: 12px;
	height: 8px;
	border-radius: 4px;
}
</style>
