// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CullTagsApi } from '../cull/cull-tags.ts'
import type { FlagApi } from '../cull/flags-api.ts'
import type { MeasureImage, SaveQualityValues } from '../hashes/quality-values.ts'
import type { HashImage, SaveVisualHashes } from '../hashes/visual-hashes.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { TrashExpectation, TrashRequestFile, TrashResponseFile } from '../logic/trash-report.ts'
import type { MoveApi } from '../move/move-flow-context.ts'
import type { LookupSeries, SaveSeries } from '../series/stored-series.ts'
import type { WarmPreviews } from '../shared/preview-warmer.ts'
import type { SidecarFlowApi } from '../sidecars/sidecar-flow.ts'

import { trashPictures as apiTrashPictures, warmPreviews as apiWarmPreviews, imageUrl, loadTagList, lookupEmbeddedXmp, lookupSidecars, movePictures, probeTargets, saveQualityValues, saveSidecars, saveVisualHashes } from '../api/index.ts'
import { saveFlags, saveSidecarEtags, takeOverFlags } from '../cull/flags-api.ts'
import { browserHashWorkers } from '../hashes/hash-workers.ts'
import { measureInWorkers } from '../hashes/quality-values.ts'
import { hashInWorkers } from '../hashes/visual-hashes.ts'
import { lookupSeries, saveSeries } from '../series/series-api.ts'
import { browserNow } from '../sidecars/sidecar-flow.ts'
import { lookupXmpCache, saveXmpCache } from '../sidecars/xmp-cache-api.ts'

/** The page's one pool of workers, which hashes and measures (SERIES-006.15). */
const HASH_WORKERS = browserHashWorkers()

/** The seams of the cull: images, hashes, flags, series, sidecars, tags, trash and move. */
export interface CullSeams {
	warmPreviews?: WarmPreviews
	/** The URL of a preview tier, which the grid, the loupe and the series compare load. */
	imageUrl?: ImageUrlFor
	hashImage?: HashImage
	saveVisualHashes?: SaveVisualHashes
	measureImage?: MeasureImage
	saveQualityValues?: SaveQualityValues
	flags?: FlagApi
	lookupSeries?: LookupSeries
	saveSeries?: SaveSeries
	trashPictures?: (pictures: readonly (readonly TrashRequestFile[])[], expect?: TrashExpectation | null) => Promise<TrashResponseFile[][]>
	sidecars?: SidecarFlowApi
	move?: MoveApi
	tags?: CullTagsApi
}

/** The cull seams the app uses in production. */
export const CULL_SEAMS = {
	warmPreviews: apiWarmPreviews,
	imageUrl,
	hashImage: hashInWorkers(HASH_WORKERS, imageUrl),
	saveVisualHashes,
	measureImage: measureInWorkers(HASH_WORKERS, imageUrl),
	saveQualityValues,
	flags: () => ({ save: saveFlags, takeOver: takeOverFlags, saveSidecarEtags }),
	lookupSeries,
	saveSeries,
	trashPictures: apiTrashPictures,
	sidecars: () => ({ lookupSidecars, lookupEmbeddedXmp, saveSidecars, lookupXmpCache, saveXmpCache, now: browserNow }),
	move: () => ({ probeTargets, movePictures }),
	tags: () => ({ loadTagList }),
}
