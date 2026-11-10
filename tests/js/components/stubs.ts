// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineComponent, h } from 'vue'

/** NcDialog in place: its name as an attribute, its body and its actions, no teleport or focus trap. */
export const DialogStub = defineComponent({
	props: { name: { type: String, required: true }, noClose: Boolean },
	emits: ['update:open'],
	setup(props, { slots }) {
		return () => h('div', { role: 'dialog', name: props.name, 'data-no-close': props.noClose }, [slots.default?.(), slots.actions?.()])
	},
})

/** NcPopover in place: the trigger and the content, always shown. */
export const PopoverStub = defineComponent({
	setup(_props, { slots }) {
		return () => h('div', [slots.trigger?.(), slots.default?.()])
	},
})

/** NcAppSettingsDialog in place: its name and sections while open, no teleport or focus trap. */
export const AppSettingsDialogStub = defineComponent({
	props: { open: Boolean, name: { type: String, required: true } },
	emits: ['update:open'],
	setup(props, { slots }) {
		return () => props.open ? h('div', { role: 'dialog', name: props.name }, slots.default?.()) : null
	},
})

/** NcAppSettingsSection in place: its name as a heading over its content. */
export const AppSettingsSectionStub = defineComponent({
	props: { id: { type: String, required: true }, name: { type: String, required: true } },
	setup(props, { slots }) {
		return () => h('section', { id: props.id }, [h('h3', props.name), slots.default?.()])
	},
})
