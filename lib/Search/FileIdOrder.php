<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Search;

use OCP\Files\FileInfo;
use OCP\Files\Search\ISearchOrder;

/** Ascending file id, the stable order a cursor pages by. */
final class FileIdOrder implements ISearchOrder {
	#[\Override]
	public function getDirection(): string {
		return ISearchOrder::DIRECTION_ASCENDING;
	}

	#[\Override]
	public function getField(): string {
		return 'fileid';
	}

	#[\Override]
	public function getExtra(): string {
		return '';
	}

	#[\Override]
	public function sortFileInfo(FileInfo $a, FileInfo $b): int {
		return $a->getId() <=> $b->getId();
	}
}
