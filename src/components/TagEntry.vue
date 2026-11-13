<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Tag, TagChange } from '../logic/tag.ts'

import { t } from '@nextcloud/l10n'
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'
import { PLAIN_TEXT } from '../l10n.ts'
import { cycleMatch, knownTag, tagChips, tagMatches, typedTag } from '../logic/tag-entry.ts'

const props = withDefaults(defineProps<{
	/** The tags of each picture the entry changes. */
	targets: readonly (readonly Tag[])[]
	/** The tags autocomplete offers, with their levels. */
	known: readonly Tag[]
	/** Whether it picks known tags for the tag filter, its one target (TAGS-004.3). */
	filter?: boolean
}>(), { filter: false })

const emit = defineEmits<{ change: [change: TagChange], close: [] }>()

const LISTBOX_ID = 'honeycomb-tag-entry-matches'

const input = useTemplateRef<HTMLInputElement>('input')
const text = ref('')
const typed = ref('')
const at = ref(-1)
const refused = ref(false)

const chips = computed(() => tagChips(props.targets))
const matched = computed(() => tagMatches(typed.value, props.known, chips.value, props.targets.length))
const offered = computed(() => (props.filter ? { ...matched.value, create: null } : matched.value))
const countOf = (tag: Tag) => chips.value.find((chip) => chip.tag === tag)?.count ?? 0
const partial = (count: number) => count > 0 && count < props.targets.length

onMounted(() => input.value!.focus())

/** Takes the field as typed: the matches follow it and cycling starts over. */
function onInput() {
	typed.value = text.value
	at.value = -1
	refused.value = false
}

/** Puts the next or previous match into the field (TAGS-003.6). */
function cycle(step: 1 | -1) {
	at.value = cycleMatch(at.value, step, offered.value.matches.length)
	if (at.value >= 0) {
		text.value = offered.value.matches[at.value]!
	}
}

/** Adds the tag to every target and empties the field. */
function assign(tag: Tag) {
	emit('change', { added: [tag], removed: [] })
	text.value = ''
	onInput()
}

/** Assigns exactly the field, or says why it cannot (TAGS-003.7, .8, TAGS-004.4). */
function assignField() {
	if (text.value.trim() === '') {
		return
	}
	const tag = (props.filter ? knownTag : typedTag)(text.value, props.known)
	if (tag === null) {
		refused.value = true
	} else {
		assign(tag)
	}
}

/** Takes the tag off every target (TAGS-003.9). */
function remove(tag: Tag) {
	emit('change', { added: [], removed: [tag] })
}

/** Removes the last chip's tag when the field is empty. */
function removeLast() {
	const last = chips.value.at(-1)
	if (text.value === '' && last !== undefined) {
		remove(last.tag)
	}
}

const KEYS: Readonly<Record<string, (event: KeyboardEvent) => void>> = {
	Tab: (event) => cycle(event.shiftKey ? -1 : 1),
	ArrowDown: () => cycle(1),
	ArrowUp: () => cycle(-1),
	Enter: assignField,
	Escape: () => emit('close'),
}

/** Runs the entry's keys and keeps them from the app; `Backspace` keeps its editing (TAGS-003.6–.12). */
function onKeydown(event: KeyboardEvent) {
	if (event.key === 'Backspace') {
		removeLast()
		return
	}
	const run = KEYS[event.key]
	if (run !== undefined) {
		event.preventDefault()
		event.stopPropagation()
		run(event)
	}
}
</script>

<template>
	<div class="tag-entry" role="dialog" :aria-label="props.filter ? t('honeycomb', 'Tag filter') : t('honeycomb', 'Tag entry')">
		<div class="tag-entry__chips">
			<span
				v-for="chip in chips"
				:key="chip.tag"
				class="tag-entry__chip"
				:class="{ 'tag-entry__chip--partial': partial(chip.count) }">
				{{ chip.tag }}
				<span v-if="partial(chip.count)" class="tag-entry__count">{{ chip.count }}/{{ props.targets.length }}</span>
				<button
					type="button"
					class="tag-entry__remove"
					:aria-label="t('honeycomb', 'Remove {tag}', { tag: chip.tag }, undefined, PLAIN_TEXT)"
					@click="remove(chip.tag)">
					<AppIcon name="close" />
				</button>
			</span>
		</div>
		<input
			ref="input"
			v-model="text"
			class="tag-entry__field"
			type="text"
			role="combobox"
			autocomplete="off"
			aria-autocomplete="list"
			:aria-expanded="offered.matches.length > 0 || offered.create !== null"
			:aria-controls="LISTBOX_ID"
			:aria-label="t('honeycomb', 'Tag')"
			:placeholder="props.filter ? t('honeycomb', 'Filter by a tag') : t('honeycomb', 'Add a tag, “/” for levels')"
			@input="onInput"
			@keydown="onKeydown">
		<p v-if="refused" class="tag-entry__refused" role="alert">
			{{ props.filter ? t('honeycomb', 'Pick a known tag') : t('honeycomb', 'A tag needs names, separated by "/", without "|"') }}
		</p>
		<ul :id="LISTBOX_ID" class="tag-entry__matches" role="listbox">
			<li
				v-for="(match, index) in offered.matches"
				:key="match"
				role="option"
				class="tag-entry__match"
				:aria-selected="index === at"
				@mousedown.prevent
				@click="assign(match)">
				{{ match }}
				<span v-if="partial(countOf(match))" class="tag-entry__count">{{ countOf(match) }}/{{ props.targets.length }}</span>
			</li>
			<li
				v-if="offered.create !== null"
				role="option"
				class="tag-entry__match tag-entry__match--create"
				aria-selected="false"
				@mousedown.prevent
				@click="assign(offered.create)">
				{{ t('honeycomb', 'Create tag "{tag}"', { tag: offered.create }, undefined, PLAIN_TEXT) }}
			</li>
		</ul>
		<NcButton class="tag-entry__done" variant="primary" @click="emit('close')">
			{{ t('honeycomb', 'Done') }}
		</NcButton>
	</div>
</template>

<style scoped src="./tag-entry.css" />
