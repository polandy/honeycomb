<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Every table of rows per file id: a new one is registered here and nowhere else. */
final readonly class FileRowStores {
	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private FlagStore $flags,
		private VisualHashStore $visualHashes,
		private SeriesStore $series,
		private XmpCacheStore $xmpCache,
		private QualityStore $quality,
		private FolderSummaryStore $folderSummaries,
		private FolderDoneStore $foldersDone,
	) {
	}

	/** @return list<FileRowStoreEntry> */
	public function all(): array {
		return [
			new FileRowStoreEntry('flag', 'vanished_after_flags', $this->flags),
			new FileRowStoreEntry('visual hash', 'vanished_after_hashes', $this->visualHashes),
			new FileRowStoreEntry('series member', 'vanished_after_series_files', $this->series),
			new FileRowStoreEntry('xmp cache', 'vanished_after_xmp_cache', $this->xmpCache),
			new FileRowStoreEntry('quality value', 'vanished_after_quality', $this->quality),
			new FileRowStoreEntry('folder summary', 'vanished_after_folder_summaries', $this->folderSummaries),
			new FileRowStoreEntry('folder done', 'vanished_after_folders_done', $this->foldersDone),
		];
	}

	/** @return list<FileRowStore> */
	public function stores(): array {
		return array_map(static fn (FileRowStoreEntry $entry): FileRowStore => $entry->store, $this->all());
	}
}
