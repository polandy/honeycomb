<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
	/** Whether the large flag buttons show. */
	shown: boolean
}>()

const emit = defineEmits<{
	'update:shown': [shown: boolean]
}>()
</script>

<template>
	<NcButton
		variant="tertiary"
		:aria-label="t('honeycomb', 'Flag buttons')"
		:pressed="props.shown"
		@update:pressed="emit('update:shown', $event)">
		<template #icon>
			<AppIcon :name="props.shown ? 'flag' : 'flagCross'" />
		</template>
	</NcButton>
</template>
