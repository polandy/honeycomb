<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { SelectionEdit, SeriesOffer } from '../logic/series-menu.ts'
import type { IconName } from './AppIcon.vue'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActionCaption from '@nextcloud/vue/components/NcActionCaption'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcActionSeparator from '@nextcloud/vue/components/NcActionSeparator'
import ActionIcon from './ActionIcon.vue'
import AppIcon from './AppIcon.vue'
import { menuEntries } from '../logic/series-menu.ts'
import { entryText, seriesCaption } from '../series/series-menu-text.ts'

const props = defineProps<{
	/** The selection as the menu sees it. */
	offer: SeriesOffer<Picture<ListingEntry>>
}>()

const emit = defineEmits<{ edit: [edit: SelectionEdit] }>()

/** The icon of each edit, as the mockup draws it. */
const ICONS: { readonly [E in SelectionEdit]: IconName } = { new: 'plus', add: 'merge', merge: 'merge', remove: 'minus', done: 'check' }

const entries = computed(() => menuEntries(props.offer).map((entry) => ({ ...entry, ...entryText(entry, props.offer) })))
</script>

<template>
	<NcActions
		forceMenu
		variant="secondary"
		:menuName="t('honeycomb', 'Series…')"
		:ariaLabel="t('honeycomb', 'Series…')"
		:disabled="props.offer.selected.length === 0">
		<template #icon>
			<AppIcon name="series" />
		</template>
		<NcActionCaption :name="seriesCaption(props.offer)" />
		<template v-for="entry in entries" :key="entry.edit">
			<NcActionSeparator v-if="entry.edit === 'done'" />
			<NcActionButton
				closeAfterClick
				:disabled="entry.blocked !== null"
				:description="entry.description"
				@click="emit('edit', entry.edit)">
				<template #icon>
					<ActionIcon :name="ICONS[entry.edit]" />
				</template>
				{{ entry.name }}
			</NcActionButton>
		</template>
	</NcActions>
</template>
