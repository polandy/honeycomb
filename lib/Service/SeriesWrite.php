<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** A whole-state series write: series to create or update, files kept out and files released (ADR 0027). */
final readonly class SeriesWrite {
	/** The most series items one write takes. */
	private const int SERIES_LIMIT = 1_000;

	/**
	 * @param list<SeriesItem> $series
	 * @param list<int> $keptOut
	 * @param list<int> $released
	 */
	private function __construct(
		public array $series,
		public array $keptOut,
		public array $released,
	) {
	}

	/**
	 * The write in a request body.
	 * @param array<array-key, mixed> $series
	 * @param array<array-key, mixed> $keptOut
	 * @param array<array-key, mixed> $released
	 * @throws InvalidSeriesException for a malformed item, a file id or series id given twice, or a limit passed
	 */
	public static function fromRequest(array $series, array $keptOut, array $released): self {
		$write = new self(
			array_map(SeriesItem::fromRequest(...), FileIds::items($series, self::SERIES_LIMIT, InvalidSeriesException::class)),
			FileIds::parse($keptOut, ListingService::ENTRY_LIMIT, InvalidSeriesException::class),
			FileIds::parse($released, ListingService::ENTRY_LIMIT, InvalidSeriesException::class),
		);
		if (count(FileIds::eachOnce($write->fileIds(), InvalidSeriesException::class)) > ListingService::ENTRY_LIMIT) {
			throw new InvalidSeriesException('A write takes at most ' . ListingService::ENTRY_LIMIT . ' file ids');
		}
		$seriesIds = array_filter(array_map(static fn (SeriesItem $item): ?int => $item->id, $write->series), static fn (?int $id): bool => $id !== null);
		if (count(array_unique($seriesIds)) !== count($seriesIds)) {
			throw new InvalidSeriesException('Each series id may appear only once');
		}
		return $write;
	}

	/**
	 * Every file id of the write: the series members, then the kept-out and the released files.
	 * @return list<int>
	 */
	public function fileIds(): array {
		return array_merge(...array_map(static fn (SeriesItem $item): array => $item->fileIds, $this->series), ...[$this->keptOut, $this->released]);
	}

	/**
	 * This write with only `$fileIds` in its lists; every series item stays.
	 * @param list<int> $fileIds
	 */
	public function only(array $fileIds): self {
		$kept = array_flip($fileIds);
		$isKept = static fn (int $fileId): bool => isset($kept[$fileId]);
		return new self(
			array_map(static fn (SeriesItem $item): SeriesItem => $item->only($kept), $this->series),
			array_values(array_filter($this->keptOut, $isKept)),
			array_values(array_filter($this->released, $isKept)),
		);
	}
}
