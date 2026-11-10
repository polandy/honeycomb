<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Where a user stopped in a folder set, and how far the cull got, for Resume and Recent. */
final readonly class ResumePosition implements \JsonSerializable {
	public function __construct(
		public FolderSet $folderSet,
		public int $fileId,
		public int $decided,
		public int $total,
		public int $updatedAt,
	) {
	}

	/** @return array{folderSet: FolderSet, fileId: int, decided: int, total: int, updatedAt: int} */
	#[\Override]
	public function jsonSerialize(): array {
		return [
			'folderSet' => $this->folderSet,
			'fileId' => $this->fileId,
			'decided' => $this->decided,
			'total' => $this->total,
			'updatedAt' => $this->updatedAt,
		];
	}
}
