<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcDialog from '@nextcloud/vue/components/NcDialog'

const props = defineProps<{
	/** The dialog's heading. */
	title: string
	/** What the confirm button does, e.g. "Cull 3 folders". */
	confirmLabel: string
	confirmDisabled?: boolean
	/** Whether the footer has *Back*. */
	back?: boolean
	/** Whether the footer has *Cancel*; without it the dialog cannot be closed either. */
	cancel?: boolean
}>()

const emit = defineEmits<{
	back: []
	cancel: []
	confirm: []
}>()

/** Closing the dialog by its close button or Escape cancels it. */
function onOpen(open: boolean) {
	if (!open) {
		emit('cancel')
	}
}
</script>

<template>
	<NcDialog
		:name="props.title"
		:noClose="!props.cancel"
		size="normal"
		@update:open="onOpen">
		<slot />
		<template #actions>
			<NcButton v-if="props.back" variant="tertiary" @click="emit('back')">
				{{ t('honeycomb', 'Back') }}
			</NcButton>
			<NcButton v-if="props.cancel" variant="tertiary" @click="emit('cancel')">
				{{ t('honeycomb', 'Cancel') }}
			</NcButton>
			<NcButton variant="primary" :disabled="props.confirmDisabled" @click="emit('confirm')">
				{{ props.confirmLabel }}
			</NcButton>
		</template>
	</NcDialog>
</template>
