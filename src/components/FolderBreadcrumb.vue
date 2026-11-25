<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Crumb, Level } from '../logic/folder-hierarchy.ts'

import { t } from '@nextcloud/l10n'
import { computed, ref, watch } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'

/** The levels above the shown one (FOLDERS-009.4); `library` leads with the *Library* of several roots. */
const props = defineProps<{ crumbs: readonly Crumb[], library: boolean }>()

const emit = defineEmits<{
	/** Show the level at the path, null for the *Library*. */
	open: [path: string | null]
}>()

const between = ref<readonly Level[]>([])
const lastIndex = computed(() => props.crumbs.length - 1)

watch(() => props.crumbs, () => {
	between.value = []
})

/** Shows or hides the levels the gap stands for. */
function toggle(levels: readonly Level[]) {
	between.value = between.value.length > 0 ? [] : levels
}
</script>

<template>
	<nav class="folder-breadcrumb" :aria-label="t('honeycomb', 'Level')">
		<ol class="folder-breadcrumb__list">
			<li v-if="props.library" class="folder-breadcrumb__item">
				<span v-if="props.crumbs.length === 0" class="folder-breadcrumb__crumb folder-breadcrumb__current" aria-current="location">
					{{ t('honeycomb', 'Library') }}
				</span>
				<NcButton
					v-else
					class="folder-breadcrumb__crumb"
					variant="tertiary"
					@click="emit('open', null)">
					{{ t('honeycomb', 'Library') }}
				</NcButton>
			</li>
			<li v-for="(crumb, index) in props.crumbs" :key="crumb.kind === 'level' ? crumb.path : 'gap'" class="folder-breadcrumb__item">
				<NcButton
					v-if="crumb.kind === 'gap'"
					class="folder-breadcrumb__crumb"
					variant="tertiary"
					:aria-label="t('honeycomb', 'More levels')"
					:aria-expanded="String(between.length > 0)"
					@click="toggle(crumb.levels)">
					<template #icon>
						<AppIcon name="more" />
					</template>
				</NcButton>
				<span
					v-else-if="index === lastIndex"
					class="folder-breadcrumb__crumb folder-breadcrumb__current"
					aria-current="location"
					translate="no">{{ crumb.name }}</span>
				<NcButton
					v-else
					class="folder-breadcrumb__crumb"
					variant="tertiary"
					translate="no"
					@click="emit('open', crumb.path)">
					{{ crumb.name }}
				</NcButton>
			</li>
		</ol>
		<div v-if="between.length > 0" class="folder-breadcrumb__between">
			<NcButton
				v-for="level in between"
				:key="level.path"
				variant="tertiary"
				translate="no"
				@click="emit('open', level.path)">
				{{ level.name }}
			</NcButton>
		</div>
	</nav>
</template>

<style scoped>
.folder-breadcrumb {
	display: grid;
	gap: var(--default-grid-baseline);
	min-width: 0;
}

.folder-breadcrumb__list {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	margin: 0;
	padding: 0;
	list-style: none;
}

.folder-breadcrumb__item {
	display: flex;
	align-items: center;
	min-width: 0;
}

.folder-breadcrumb__item + .folder-breadcrumb__item::before {
	padding: 0 var(--default-grid-baseline);
	color: var(--color-text-maxcontrast);
	content: "›";
}

.folder-breadcrumb__current {
	overflow: hidden;
	padding: 0 calc(2 * var(--default-grid-baseline));
	font-weight: bold;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.folder-breadcrumb__between {
	display: flex;
	flex-wrap: wrap;
	gap: var(--default-grid-baseline);
}
</style>
