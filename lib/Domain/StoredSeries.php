<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain;

/** A stored series as a lookup answers it: its members among the asked file ids. */
final readonly class StoredSeries implements \JsonSerializable {
	/**
	 * @param list<int> $fileIds the members among the asked file ids, in file id order
	 * @param bool $elsewhere whether the series has members outside the asked file ids
	 */
	public function __construct(
		public int $id,
		public SeriesStatus $status,
		public array $fileIds,
		public bool $elsewhere,
	) {
	}

	/** @return array{id: int, status: string, fileIds: list<int>, elsewhere: bool} */
	#[\Override]
	public function jsonSerialize(): array {
		return ['id' => $this->id, 'status' => $this->status->value, 'fileIds' => $this->fileIds, 'elsewhere' => $this->elsewhere];
	}
}
