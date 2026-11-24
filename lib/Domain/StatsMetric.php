<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain;

/** What a daily counter counts, by the key it is stored under (STATS-001). */
enum StatsMetric: string {
	case PicturesDecided = 'pictures_decided';
	case PicturesPicked = 'pictures_picked';
	case PicturesRejected = 'pictures_rejected';
	case RatingsSet = 'ratings_set';
	case ColourLabelsSet = 'colour_labels_set';
	case TagsSet = 'tags_set';
	case TrashPictures = 'trash_pictures';
	case TrashFiles = 'trash_files';
	case TrashBytes = 'trash_bytes';
	case DeletedPictures = 'deleted_pictures';
	case DeletedFiles = 'deleted_files';
	case DeletedBytes = 'deleted_bytes';
	case RawsRemoved = 'raws_removed';
	case RawsRemovedBytes = 'raws_removed_bytes';
	case SidecarsCreated = 'sidecars_created';
	case SidecarsUpdated = 'sidecars_updated';
	case SidecarsForeign = 'sidecars_foreign';
	case SeriesDone = 'series_done';
	case FoldersDone = 'folders_done';
	case PicturesMoved = 'pictures_moved';
	case ActiveSeconds = 'active_seconds';
}
