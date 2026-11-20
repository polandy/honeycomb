<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { SendProgress } from '../logic/request-chunks.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, nextTick, onMounted, useTemplateRef } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import ProgressBar from './ProgressBar.vue'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'

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

/** The input types whose Escape has no use of its own, which NcModal still leaves to them. */
const TOGGLES = new Set(['checkbox', 'radio'])

/** Escape from a switch, checkbox or radio button cancels the dialog as from anywhere else in it (APP-001.16). */
function onEscape(event: KeyboardEvent) {
	if (props.cancel && event.target instanceof HTMLInputElement && TOGGLES.has(event.target.type)) {
		emit('cancel')
	}
}

/** Closing the dialog by its close button or Escape cancels it. */
function onOpen(open: boolean) {
	if (!open) {
		emit('cancel')
	}
}
</script>

<template>
	<NcDialog
		class="confirm-dialog"
		:name="props.title"
		:noClose="!props.cancel"
		:container="props.container ?? 'body'"
		:size="props.wide ? 'large' : 'normal'"
		@update:open="onOpen"
		@keydown.esc="onEscape">
		<slot />
		<template #actions>
			<span v-if="props.progress" class="confirm-dialog__progress">
				<ProgressBar :label="progressText" :value="props.progress.done" :max="props.progress.total" />
				{{ progressText }}
			</span>
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
	</NcDialog>
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
/* Unscoped: NcModal teleports the dialog out of this component; the mockup's phone breakpoint. */
@media only screen and (max-width: 520px) {
	.confirm-dialog.modal-mask .modal-wrapper {
		align-items: flex-end;
	}

	.confirm-dialog.modal-mask .modal-wrapper .modal-container {
		position: absolute;
		top: auto;
		bottom: 0;
		width: 100%;
		height: auto;
		max-height: calc(100% - 24px - env(safe-area-inset-top, 0px));
		border-radius: 16px 16px 0 0;
	}

	.confirm-dialog.modal-mask .dialog__actions {
		flex-wrap: wrap;
		padding-bottom: env(safe-area-inset-bottom, 0px);
	}

	.confirm-dialog.modal-mask .confirm-dialog__progress {
		flex-basis: 100%;
	}
}
</style>
