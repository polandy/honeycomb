<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'

defineProps<{ foldersUrl: string }>()
</script>

<template>
	<section class="statistics-empty" :aria-label="t('honeycomb', 'Nothing counted yet')">
		<span class="statistics-empty__hexes" aria-hidden="true">⬡⬢⬡</span>
		<h3>{{ t('honeycomb', 'Nothing counted yet') }}</h3>
		<p>{{ t('honeycomb', 'Cull a folder and the numbers show here.') }}</p>
		<NcButton variant="primary" :href="foldersUrl">
			{{ t('honeycomb', 'Open Folders') }}
		</NcButton>
	</section>
</template>

<style scoped>
.statistics-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
	padding: calc(6 * var(--default-grid-baseline)) calc(4 * var(--default-grid-baseline));
	border-radius: var(--border-radius-large);
	background: var(--color-background-hover);
	text-align: center;
}

.statistics-empty h3,
.statistics-empty p {
	margin: 0;
}

.statistics-empty__hexes {
	font-size: 40px;
	line-height: 1;
	color: var(--color-primary-element);
}
</style>
