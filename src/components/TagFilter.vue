<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Tag, TagChange } from '../logic/tag.ts'

import { t } from '@nextcloud/l10n'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import AppIcon from './AppIcon.vue'
import TagEntry from './TagEntry.vue'
import { PLAIN_TEXT } from '../l10n.ts'
import { changedTags, sortedTags } from '../logic/tag.ts'

const props = defineProps<{
	/** The chosen tags; a picture needs every one. */
	tags: ReadonlySet<Tag>
	/** The tags the entry offers. */
	known: readonly Tag[]
}>()

const emit = defineEmits<{ 'update:tags': [tags: ReadonlySet<Tag>] }>()

const add = useTemplateRef<HTMLButtonElement>('add')
const picking = ref(false)
const chosen = computed(() => sortedTags([...props.tags]))

/** Emits the chosen tags with the change applied (TAGS-004.3, .5). */
function change(step: TagChange) {
	emit('update:tags', new Set(changedTags(chosen.value, step)))
}

/** Closes the entry and gives the focus back to *Add tag*. */
async function close() {
	picking.value = false
	await nextTick()
	add.value?.focus()
}
</script>

<template>
	<div class="filter-bar__group" role="group" :aria-label="t('honeycomb', 'Tags')">
		<span class="filter-bar__label" aria-hidden="true">{{ t('honeycomb', 'Tags') }}</span>
		<div class="filter-bar__chips">
			<button
				v-for="tag in chosen"
				:key="tag"
				type="button"
				class="filter-bar__chip tag-filter__chip"
				aria-pressed="true"
				:aria-label="t('honeycomb', 'Remove {tag} from the filter', { tag }, undefined, PLAIN_TEXT)"
				@click="change({ added: [], removed: [tag] })">
				{{ tag }}
				<AppIcon name="close" />
			</button>
			<button
				ref="add"
				type="button"
				class="filter-bar__chip"
				:aria-expanded="picking"
				@click="picking = true">
				<AppIcon name="tag" />
				{{ t('honeycomb', 'Add tag') }}
			</button>
		</div>
		<TagEntry
			v-if="picking"
			:targets="[chosen]"
			:known="props.known"
			filter
			@change="change"
			@close="close" />
	</div>
</template>

<style scoped src="./filter-bar.css" />
