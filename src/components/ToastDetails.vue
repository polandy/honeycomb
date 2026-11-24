<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { DetailedToast } from '../shared/toast.ts'

import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcDialog from '@nextcloud/vue/components/NcDialog'

const props = defineProps<{
	detailed: DetailedToast
}>()

const emit = defineEmits<{
	close: []
}>()
</script>

<template>
	<NcDialog
		:name="props.detailed.message"
		container="body"
		@update:open="emit('close')">
		<ul class="toast-details__list">
			<li v-for="(detail, at) in props.detailed.details" :key="at">
				{{ detail }}
			</li>
		</ul>
		<template #actions>
			<NcButton variant="primary" @click="emit('close')">
				{{ t('honeycomb', 'Close') }}
			</NcButton>
		</template>
	</NcDialog>
</template>

<style scoped>
.toast-details__list {
	padding-inline-start: calc(4 * var(--default-grid-baseline));
	list-style: disc;
	overflow-wrap: anywhere;
}
</style>
