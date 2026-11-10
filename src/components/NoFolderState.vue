<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'

const emit = defineEmits<{
	chooseFolder: []
}>()
</script>

<template>
	<NcEmptyContent
		:name="t('honeycomb', 'No folder chosen')"
		:description="t('honeycomb', 'Pick a folder to start culling.')">
		<template #action>
			<NcButton variant="primary" @click="emit('chooseFolder')">
				{{ t('honeycomb', 'Choose a folder…') }}
			</NcButton>
		</template>
	</NcEmptyContent>
</template>
