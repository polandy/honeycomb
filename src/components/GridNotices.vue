<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Picture } from '../logic/pairing.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { ambiguousNames } from '../logic/ambiguous-names.ts'

const props = defineProps<{
	/** The pictures the grid shows. */
	pictures: readonly Picture<unknown>[]
	saveFailed: boolean
}>()

const ambiguous = computed(() => ambiguousNames(props.pictures).map(({ folder, baseName, count }) => ({
	key: `${folder}/${baseName}`,
	text: n('honeycomb', '{count} file shares the name {name}; shown as singles', '{count} files share the name {name}; shown as singles', count, { count: formatNumber(count), name: baseName }, PLAIN_TEXT),
})))
</script>

<template>
	<NcNoteCard v-if="props.saveFailed" type="error" :text="t('honeycomb', 'Could not save the change; the photos show what is stored.')" />
	<NcNoteCard
		v-for="notice in ambiguous"
		:key="notice.key"
		type="warning"
		:text="notice.text" />
</template>
