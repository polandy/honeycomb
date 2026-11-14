<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Flag } from '../logic/decision.ts'
import type { SwipeDirection } from '../logic/loupe-gesture.ts'
import type { Settings } from '../logic/settings.ts'

import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'

const props = defineProps<{
	settings: Settings
	/** Whether the gesture guide counts as seen, which its hint tells. */
	gestureGuideSeen: boolean
}>()

const emit = defineEmits<{
	/** A change of the settings; the app applies and saves it at once. */
	update: [patch: Partial<Settings>]
	/** The user wants the gesture guide on the next loupe opening. */
	showGestureGuide: []
}>()

const SWIPES = [
	{ direction: 'up', label: t('honeycomb', 'Swipe up') },
	{ direction: 'down', label: t('honeycomb', 'Swipe down') },
] as const

const SWITCHES = [
	{ key: 'autoAdvance', label: t('honeycomb', 'Auto-advance to the next undecided photo'), description: t('honeycomb', 'After pick or reject, not after rating or colour label') },
	{ key: 'flagButtonsShown', label: t('honeycomb', 'Show flag buttons'), description: t('honeycomb', 'Pick, Unflag and Reject in the loupe and the series viewer. Hidden, the photo gets their room; keys, swipes and tooltips keep working, and the flag in the title row shows them again.') },
	{ key: 'filmstripPinned', label: t('honeycomb', 'Pin the filmstrip'), description: t('honeycomb', 'Always shown below the photo instead of over it, also when the other controls fade') },
	{ key: 'ratingRowPinned', label: t('honeycomb', 'Pin the rating row'), description: t('honeycomb', 'Stars, colour labels and Keep RAW always shown below the photo instead of over it') },
] as const

/** Sets what the swipe in `direction` does; an empty value is Nothing. */
function setSwipe(direction: SwipeDirection, value: string) {
	emit('update', { swipes: { ...props.settings.swipes, [direction]: value === '' ? null : value as Flag } })
}
</script>

<template>
	<div>
		<p class="loupe-gesture-settings__hint settings-text">
			{{ t('honeycomb', 'A direction set to Nothing turns that swipe off.') }}
		</p>
		<label v-for="{ direction, label } in SWIPES" :key="direction" class="loupe-gesture-settings__row settings-text">
			<span>{{ label }}</span>
			<select
				:value="settings.swipes[direction] ?? ''"
				:aria-label="label"
				@change="setSwipe(direction, ($event.target as HTMLSelectElement).value)">
				<option value="picked">{{ t('honeycomb', 'Pick') }}</option>
				<option value="rejected">{{ t('honeycomb', 'Reject') }}</option>
				<option value="">{{ t('honeycomb', 'Nothing') }}</option>
			</select>
		</label>
		<NcCheckboxRadioSwitch
			v-for="item in SWITCHES"
			:key="item.key"
			type="switch"
			:modelValue="settings[item.key]"
			:description="item.description"
			@update:modelValue="emit('update', { [item.key]: $event })">
			{{ item.label }}
		</NcCheckboxRadioSwitch>
		<div class="loupe-gesture-settings__row settings-text">
			<div>
				<div>{{ t('honeycomb', 'Gesture guide') }}</div>
				<div id="gesture-guide-hint" class="loupe-gesture-settings__hint">
					{{ gestureGuideSeen ? t('honeycomb', 'The card with the swipes, tap zones and keys from the first loupe opening') : t('honeycomb', 'Shows the next time you open the loupe') }}
				</div>
			</div>
			<NcButton aria-describedby="gesture-guide-hint" @click="emit('showGestureGuide')">
				{{ t('honeycomb', 'Show the gesture guide') }}
			</NcButton>
		</div>
	</div>
</template>

<style scoped src="./settings-text.css" />

<style scoped>
.loupe-gesture-settings__hint {
	color: var(--color-text-maxcontrast);
	margin-block-end: calc(2 * var(--default-grid-baseline));
}

.loupe-gesture-settings__row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: calc(2 * var(--default-grid-baseline));
	margin-block-end: calc(2 * var(--default-grid-baseline));
}
</style>
