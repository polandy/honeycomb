<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Every table of rows per file id: a new one is registered here and nowhere else. */
final readonly class FileRowStores {
	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private DecisionStore $decisions,
		private TagStore $tags,
		private VisualHashStore $visualHashes,
		private SeriesStore $series,
	) {
	}

	/** @return list<FileRowStoreEntry> */
	public function all(): array {
		return [
			new FileRowStoreEntry('decision', 'vanished_after_decisions', $this->decisions),
			new FileRowStoreEntry('tag', 'vanished_after_file_tags', $this->tags),
			new FileRowStoreEntry('visual hash', 'vanished_after_hashes', $this->visualHashes),
			new FileRowStoreEntry('series member', 'vanished_after_series_files', $this->series),
		];
	}

	/** @return list<FileRowStore> */
	public function stores(): array {
		return array_map(static fn (FileRowStoreEntry $entry): FileRowStore => $entry->store, $this->all());
	}
}
