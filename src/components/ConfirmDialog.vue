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
	/** The *Back* button's label, *Back* by default. */
	backLabel?: string
	/** The *Cancel* button's label, *Cancel* by default. */
	cancelLabel?: string
	/** A large dialog, for a grid or a file list. */
	wide?: boolean
	/** The confirm button warns, for an action that removes files. */
	danger?: boolean
	/** Where the dialog opens, e.g. inside the loupe; the page body by default. */
	container?: string | undefined
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
		:container="props.container ?? 'body'"
		:size="props.wide ? 'large' : 'normal'"
		@update:open="onOpen">
		<slot />
		<template #actions>
			<NcButton v-if="props.back" variant="tertiary" @click="emit('back')">
				{{ props.backLabel ?? t('honeycomb', 'Back') }}
			</NcButton>
			<NcButton v-if="props.cancel" variant="tertiary" @click="emit('cancel')">
				{{ props.cancelLabel ?? t('honeycomb', 'Cancel') }}
			</NcButton>
			<NcButton :variant="props.danger ? 'error' : 'primary'" :disabled="props.confirmDisabled" @click="emit('confirm')">
				{{ props.confirmLabel }}
			</NcButton>
		</template>
	</NcDialog>
</template>
