<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import NcAppContent from '@nextcloud/vue/components/NcAppContent'
import NcContent from '@nextcloud/vue/components/NcContent'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
</script>

<template>
	<NcContent appName="honeycomb">
		<NcAppContent>
			<NcEmptyContent
				:name="t('honeycomb', 'No folder chosen')"
				:description="t('honeycomb', 'Pick a folder to start culling.')" />
		</NcAppContent>
	</NcContent>
</template>
