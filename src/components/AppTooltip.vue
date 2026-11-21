<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Schedule } from '../logic/long-press.ts'
import type { Box, TipPlacement } from '../logic/tooltip.ts'

import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { browserSchedule } from '../browser-schedule.ts'
import { placeTip } from '../logic/tooltip.ts'
import { TIP_ID, useTooltip } from '../tooltip.ts'

const props = withDefaults(defineProps<{
	/** The timer of the hover delay and the long-press. */
	schedule?: Schedule
	/** Milliseconds on a monotonic clock. */
	now?: () => number
	/** The full-screen view to show in, as the browser shows nothing outside it; the page by default. */
	container?: string | undefined
}>(), {
	schedule: () => browserSchedule,
	now: () => () => performance.now(),
	container: 'body',
})

const bubble = useTemplateRef<HTMLElement>('bubble')
const safe = useTemplateRef<HTMLElement>('safe')
const { anchor } = useTooltip({ schedule: props.schedule, now: () => props.now() }, () => bubble.value)
const placement = ref<TipPlacement | null>(null)
const label = computed(() => anchor.value?.dataset.tip ?? '')
const key = computed(() => anchor.value?.dataset.tipKey)

/** A rectangle as a box. */
const boxOf = ({ left, top, right, bottom }: DOMRect): Box => ({ left, top, right, bottom })

/** The screen without its safe areas (notch, home indicator). */
function frame(): Box {
	const inset = safe.value === null ? null : getComputedStyle(safe.value)
	const side = (value: string | undefined) => Number.parseFloat(value ?? '') || 0
	return { left: side(inset?.paddingLeft), top: side(inset?.paddingTop), right: window.innerWidth - side(inset?.paddingRight), bottom: window.innerHeight - side(inset?.paddingBottom) }
}

/** The photo shown in the loupe or series viewer, which the bubble keeps off. */
function photo(): Box | null {
	const shown = [...document.querySelectorAll('[data-tip-avoid]')].map((element) => element.getBoundingClientRect()).find((rect) => rect.width > 0 && rect.height > 0)
	return shown === undefined ? null : boxOf(shown)
}

watch(anchor, async (next) => {
	placement.value = null
	await nextTick()
	if (next === null || next !== anchor.value || bubble.value === null) {
		return
	}
	const { width, height } = bubble.value.getBoundingClientRect()
	placement.value = placeTip(boxOf(next.getBoundingClientRect()), { width, height }, frame(), photo())
})

const style = computed(() => placement.value === null
	? { visibility: 'hidden' as const }
	: { left: `${placement.value.x}px`, top: `${placement.value.y}px`, '--tip-arrow': `${placement.value.arrow}px` })
</script>

<template>
	<Teleport :to="props.container">
		<div ref="safe" class="app-tooltip__safe" aria-hidden="true" />
		<div
			v-show="anchor !== null"
			:id="TIP_ID"
			ref="bubble"
			class="tip-bubble app-tooltip"
			role="tooltip"
			:data-side="placement?.side"
			:style="style">
			<span class="app-tooltip__label">{{ label }}</span>
			<kbd v-if="key !== undefined">{{ key }}</kbd>
			<i class="tip-bubble__arrow" aria-hidden="true" />
		</div>
	</Teleport>
</template>

<style scoped>
.app-tooltip__safe {
	position: fixed;
	visibility: hidden;
	pointer-events: none;
	padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}

.app-tooltip {
	display: flex;
	align-items: center;
	gap: 8px;
	font-weight: 600;
}

.app-tooltip kbd {
	min-width: 22px;
	padding: 0 5px;
	border: 1px solid currentColor;
	border-radius: var(--border-radius-small, 4px);
	font-family: inherit;
	text-align: center;
}
</style>

<style scoped src="./tip-bubble.css" />
