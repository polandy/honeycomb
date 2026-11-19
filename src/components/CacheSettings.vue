<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'

defineProps<{
	/** Whether the user is an admin, who may clean up the orphaned data. */
	admin: boolean
}>()

const emit = defineEmits<{
	/** The user wants honeycomb to forget the sidecars and photos it read. */
	clearCache: []
	/** The admin wants the flags of deleted and trashed files removed. */
	cleanUp: []
}>()
</script>

<template>
	<p id="clear-cache-hint" class="cache-settings__hint settings-text">
		{{ t('honeycomb', 'Removes what honeycomb remembers of the sidecars and photos it read; it reads them again on the next visit. Sidecars and decisions stay.') }}
	</p>
	<NcButton aria-describedby="clear-cache-hint" @click="emit('clearCache')">
		{{ t('honeycomb', 'Clear cache') }}
	</NcButton>
	<template v-if="admin">
		<p id="clean-up-hint" class="cache-settings__hint settings-text">
			{{ t('honeycomb', 'Removes the picks and rejects of files that were deleted or lie in a trash bin, for every user.') }}
		</p>
		<NcButton aria-describedby="clean-up-hint" @click="emit('cleanUp')">
			{{ t('honeycomb', 'Clean up orphaned data') }}
		</NcButton>
	</template>
</template>

<style scoped src="./settings-text.css" />

<style scoped>
.cache-settings__hint {
	color: var(--color-text-maxcontrast);
	margin-block-end: calc(2 * var(--default-grid-baseline));
}
</style>
