<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { SendProgress } from '../logic/request-chunks.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, nextTick, onMounted, useTemplateRef } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import ModalPanel from './ModalPanel.vue'
import ProgressBar from './ProgressBar.vue'
import { formatNumber, PLAIN_TEXT } from '../shared/l10n.ts'

const props = defineProps<{
	/** The dialog's heading. */
	title: string
	/** What the confirm button does, e.g. "Cull 3 folders". */
	confirmLabel: string
	confirmDisabled?: boolean
	/** Whether the footer has *Back*. */
	back?: boolean
	/** Whether the footer has *Cancel*; without it the dialog cannot be closed either, e.g. during a send. */
	cancel?: boolean
	/** The *Back* button's label, *Back* by default. */
	backLabel?: string
	/** The *Cancel* button's label, *Cancel* by default. */
	cancelLabel?: string
	/** A large dialog, for a grid or a file list. */
	wide?: boolean
	/** The confirm button warns, for an action that removes files. */
	danger?: boolean
	/** The focus starts on *Cancel*, for a confirm that cannot be undone. */
	focusCancel?: boolean
	/** The confirm button is secondary, where the dialog's body holds the primary action. */
	secondary?: boolean
	/** Where the dialog opens, e.g. inside the loupe; the page body by default. */
	container?: string | undefined
	/** How many photos a running send has sent, shown in the footer (ADR 0029). */
	progress?: SendProgress | null | undefined
}>()

const emit = defineEmits<{
	back: []
	cancel: []
	confirm: []
}>()

/** "50 of 120 photos sent". */
const progressText = computed(() => (props.progress
	? n('honeycomb', '{done} of {total} photo sent', '{done} of {total} photos sent', props.progress.total, { done: formatNumber(props.progress.done), total: formatNumber(props.progress.total) }, PLAIN_TEXT)
	: ''))

const cancelButton = useTemplateRef<InstanceType<typeof NcButton>>('cancelButton')

onMounted(async () => {
	if (props.focusCancel) {
		// After the modal's own mount; its focus trap keeps a focus already inside it.
		await nextTick()
		const button = cancelButton.value?.$el as HTMLElement | undefined
		button?.focus()
	}
})
</script>

<template>
	<ModalPanel
		class="confirm-dialog"
		:title="props.title"
		:locked="!props.cancel"
		:container="props.container"
		:size="props.wide ? 'large' : 'normal'"
		@close="emit('cancel')">
		<slot />
		<template #actions>
			<span v-if="props.progress" class="confirm-dialog__progress">
				<ProgressBar :label="progressText" :value="props.progress.done" :max="props.progress.total" />
				{{ progressText }}
			</span>
			<!-- A further action before the dialog's own buttons, e.g. a link to another page. -->
			<slot name="actions" />
			<NcButton v-if="props.back" variant="tertiary" @click="emit('back')">
				{{ props.backLabel ?? t('honeycomb', 'Back') }}
			</NcButton>
			<NcButton
				v-if="props.cancel"
				ref="cancelButton"
				variant="tertiary"
				@click="emit('cancel')">
				{{ props.cancelLabel ?? t('honeycomb', 'Cancel') }}
			</NcButton>
			<NcButton :variant="props.danger ? 'error' : props.secondary ? 'secondary' : 'primary'" :disabled="props.confirmDisabled" @click="emit('confirm')">
				{{ props.confirmLabel }}
			</NcButton>
		</template>
	</ModalPanel>
</template>

<style scoped>
.confirm-dialog__progress {
	display: flex;
	align-items: center;
	gap: var(--default-grid-baseline);
	margin-inline-end: auto;
	color: var(--color-text-maxcontrast);
}
</style>

<style>
/* Unscoped: the panel is teleported out of this component; the mockup's phone breakpoint. */
@media only screen and (max-width: 520px) {
	.confirm-dialog.modal-mask .confirm-dialog__progress {
		flex-basis: 100%;
	}
}
</style>
