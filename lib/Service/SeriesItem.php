<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** One series of a write: its id, null for a new one, its status and the members it gains. */
final readonly class SeriesItem {
	/** @param list<int> $fileIds */
	public function __construct(
		public ?int $id,
		public SeriesStatus $status,
		public array $fileIds,
	) {
	}

	/**
	 * The series in a request item; `id` is required and may be null.
	 * @throws InvalidSeriesException for a missing or malformed field
	 */
	public static function fromRequest(mixed $item): self {
		if (!is_array($item) || !array_key_exists('id', $item)) {
			throw new InvalidSeriesException('A series item must be an object with an id');
		}
		$id = $item['id'];
		if ($id !== null && (!is_int($id) || $id < 1)) {
			throw new InvalidSeriesException('id must be null or a positive integer');
		}
		$status = isset($item['status']) && is_string($item['status']) ? SeriesStatus::tryFrom($item['status']) : null;
		if ($status === null) {
			throw new InvalidSeriesException('status must be open or done');
		}
		$fileIds = $item['fileIds'] ?? null;
		if (!is_array($fileIds)) {
			throw new InvalidSeriesException('fileIds must be a list');
		}
		return new self($id, $status, FileIds::parse($fileIds, ListingService::ENTRY_LIMIT, InvalidSeriesException::class));
	}

	/**
	 * This series with only the members among `$fileIds`.
	 * @param array<int, mixed> $fileIds keyed by file id
	 */
	public function only(array $fileIds): self {
		return new self($this->id, $this->status, array_values(array_filter($this->fileIds, static fn (int $fileId): bool => isset($fileIds[$fileId]))));
	}
}
