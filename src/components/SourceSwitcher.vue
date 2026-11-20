<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { SourceKind } from '../immich-source.ts'

import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ source: SourceKind }>()

const emit = defineEmits<{ choose: [source: SourceKind] }>()
</script>

<template>
	<div class="source-switcher" role="group" :aria-label="t('honeycomb', 'Source')">
		<NcButton :pressed="props.source === 'nextcloud'" wide @click="emit('choose', 'nextcloud')">
			<template #icon>
				<AppIcon name="folder" />
			</template>
			{{ t('honeycomb', 'Nextcloud') }}
		</NcButton>
		<NcButton :pressed="props.source === 'immich'" wide @click="emit('choose', 'immich')">
			<template #icon>
				<AppIcon name="phone" />
			</template>
			{{ t('honeycomb', 'Immich') }}
		</NcButton>
	</div>
</template>

<style scoped>
.source-switcher {
	display: flex;
	gap: var(--default-grid-baseline);
	padding: var(--default-grid-baseline) calc(2 * var(--default-grid-baseline));
}
</style>
