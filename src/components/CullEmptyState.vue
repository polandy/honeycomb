<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { EmptyReason } from '../logic/picture-filter.ts'

import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'

const props = defineProps<{
	reason: EmptyReason | null
	/** How many pictures are rejected; *Review rejects* shows when there are any. */
	rejected: number
}>()

const emit = defineEmits<{
	clearFilters: []
	showAll: []
	reviewRejects: []
}>()
</script>

<template>
	<NcEmptyContent v-if="props.reason === 'no-pictures'" :name="t('honeycomb', 'No photos in these folders')" />
	<NcEmptyContent v-else-if="props.reason === 'no-match'" :name="t('honeycomb', 'Nothing matches these filters')">
		<template #action>
			<NcButton @click="emit('clearFilters')">
				{{ t('honeycomb', 'Clear filters') }}
			</NcButton>
		</template>
	</NcEmptyContent>
	<NcEmptyContent
		v-else
		:name="props.reason === 'all-decided' ? t('honeycomb', 'Every photo is decided') : t('honeycomb', 'No photos left to cull')">
		<template #action>
			<NcButton v-if="props.rejected > 0" variant="primary" @click="emit('reviewRejects')">
				{{ t('honeycomb', 'Review rejects') }}
			</NcButton>
			<NcButton @click="emit('showAll')">
				{{ t('honeycomb', 'Show all') }}
			</NcButton>
		</template>
	</NcEmptyContent>
</template>
