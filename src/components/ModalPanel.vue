<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import { lockScroll } from '../shared/scroll-lock.ts'

const props = withDefaults(defineProps<{
	/** The panel's heading, which also names the dialog. */
	title: string
	/** Whether it stays open with no close button, Escape or backdrop, e.g. while it works. */
	locked?: boolean
	/** How wide it is; every size but `full` is a bottom sheet on a phone. */
	size?: 'small' | 'normal' | 'large' | 'full'
	/** Where it opens, e.g. inside the loupe; the page body by default. */
	container?: string | undefined
}>(), { size: 'small', container: undefined })

const emit = defineEmits<{
	/** The user closed it by its close button, Escape or the backdrop. */
	close: []
}>()

let releaseScroll = () => {}
onMounted(() => {
	releaseScroll = lockScroll(document.documentElement)
})
onBeforeUnmount(() => releaseScroll())

/** The input types whose Escape has no use of its own, which NcModal still leaves to them. */
const TOGGLES = new Set(['checkbox', 'radio'])

/** Whether Escape belongs to a text field, which NcModal leaves it to. */
const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/** Escape from a switch, checkbox or radio button closes the panel too (APP-001.16); an Escape that closes it is handled, so the screen's keys skip it (APP-001.23). */
function onEscape(event: KeyboardEvent) {
	const target = event.target
	if (props.locked) {
		return
	}
	if (target instanceof HTMLInputElement && TOGGLES.has(target.type)) {
		emit('close')
	} else if (typing(target)) {
		return
	}
	event.preventDefault()
}
</script>

<template>
	<NcDialog
		class="modal-panel"
		:class="{ 'modal-panel--sheet': props.size !== 'full' }"
		:name="props.title"
		:noClose="props.locked"
		:closeOnClickOutside="!props.locked"
		:container="props.container ?? 'body'"
		:size="props.size"
		@closing="emit('close')"
		@keydown.esc="onEscape">
		<slot />
		<template v-if="$slots.actions" #actions>
			<slot name="actions" />
		</template>
	</NcDialog>
</template>

<style>
/* Unscoped: NcModal teleports the panel out of this component; the mockup's phone breakpoint. */
.modal-panel.modal-mask .modal-container {
	overscroll-behavior: contain;
}

@media only screen and (max-width: 520px) {
	.modal-panel--sheet.modal-mask .modal-wrapper {
		align-items: flex-end;
	}

	.modal-panel--sheet.modal-mask .modal-wrapper .modal-container {
		position: absolute;
		top: auto;
		bottom: 0;
		width: 100%;
		height: auto;
		max-height: calc(100% - 24px - env(safe-area-inset-top, 0px));
		border-radius: 16px 16px 0 0;
	}

	.modal-panel--sheet.modal-mask .dialog__actions {
		flex-wrap: wrap;
		padding-bottom: env(safe-area-inset-bottom, 0px);
	}
}
</style>
