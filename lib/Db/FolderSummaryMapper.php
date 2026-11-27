<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Domain\FolderSummary;
use OCA\Honeycomb\Domain\Store\FolderSummaryStore;
use OCP\AppFramework\Db\TTransactional;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/** Keeps the one summary of each folder in `honeycomb_folder_summary`, without a user (ADR 0049). */
final class FolderSummaryMapper implements FolderSummaryStore {
	use FileRowQueries;
	use TTransactional;

	private const string TABLE = 'honeycomb_folder_summary';
	private const array COLUMNS = [
		'file_id' => IQueryBuilder::PARAM_INT,
		'etag' => IQueryBuilder::PARAM_STR,
		'photos' => IQueryBuilder::PARAM_INT,
		'bytes' => IQueryBuilder::PARAM_INT,
		'raw_bytes' => IQueryBuilder::PARAM_INT,
		'bursts' => IQueryBuilder::PARAM_INT,
		'oldest' => IQueryBuilder::PARAM_INT,
		'newest' => IQueryBuilder::PARAM_INT,
		'last_activity' => IQueryBuilder::PARAM_INT,
		'previews' => IQueryBuilder::PARAM_STR,
		'shot_days' => IQueryBuilder::PARAM_STR,
		'scanned_at' => IQueryBuilder::PARAM_INT,
	];

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private IDBConnection $db,
	) {
	}

	/** The table, without the instance's prefix. */
	#[\Override]
	public function getTableName(): string {
		return self::TABLE;
	}

	#[\Override]
	public function find(array $fileIds): array {
		$summaries = [];
		foreach ($this->findFileRows(null, $fileIds) as $row) {
			$summary = new FolderSummary(
				(int)$row['file_id'],
				(string)$row['etag'],
				(int)$row['photos'],
				(int)$row['bytes'],
				(int)$row['raw_bytes'],
				(int)$row['bursts'],
				self::nullableInt($row['oldest']),
				self::nullableInt($row['newest']),
				self::nullableInt($row['last_activity']),
				(int)$row['scanned_at'],
				self::decodePreviews($row['previews']),
				self::decodeShotDays($row['shot_days']),
			);
			$summaries[$summary->fileId] = $summary;
		}
		return $summaries;
	}

	/** Sorted by file id, so two scans at once take their row locks in the same order. */
	#[\Override]
	public function replace(array $summaries): void {
		usort($summaries, static fn (FolderSummary $a, FolderSummary $b): int => $a->fileId <=> $b->fileId);
		$this->atomic(function () use ($summaries): void {
			$this->deleteFileRows(null, array_map(static fn (FolderSummary $summary): int => $summary->fileId, $summaries));
			$this->insertRows(new InsertStatements(self::TABLE, self::COLUMNS), array_map(static fn (FolderSummary $summary): array => [
				'file_id' => $summary->fileId,
				'etag' => $summary->etag,
				'photos' => $summary->photos,
				'bytes' => $summary->bytes,
				'raw_bytes' => $summary->rawBytes,
				'bursts' => $summary->bursts,
				'oldest' => $summary->oldest,
				'newest' => $summary->newest,
				'last_activity' => $summary->lastActivity,
				'scanned_at' => $summary->scannedAt,
				'previews' => self::encodePreviews($summary->previews),
				'shot_days' => self::encodeShotDays($summary->shotDays),
			], $summaries));
		}, $this->db);
	}

	#[\Override]
	public function clearAll(): int {
		return $this->clearRows(null);
	}

	/** @param list<array{fileId: int, mtime: int}> $previews as `fileId:mtime,fileId:mtime`; null without any */
	private static function encodePreviews(array $previews): ?string {
		return $previews === [] ? null : implode(',', array_map(static fn (array $preview): string => $preview['fileId'] . ':' . $preview['mtime'], $previews));
	}

	/** @return list<array{fileId: int, mtime: int}> */
	private static function decodePreviews(mixed $value): array {
		if (!is_string($value) || $value === '') {
			return [];
		}
		return array_map(static function (string $pair) use ($value): array {
			if (preg_match('/^(\d+):(\d+)$/', $pair, $parts) !== 1) {
				throw new \UnexpectedValueException("Malformed folder previews: $value");
			}
			return ['fileId' => (int)$parts[1], 'mtime' => (int)$parts[2]];
		}, explode(',', $value));
	}

	/** @param array<string, int> $shotDays as `YYYY-MM-DD:n,YYYY-MM-DD:n` (ADR 0062); null without any */
	private static function encodeShotDays(array $shotDays): ?string {
		return $shotDays === [] ? null : implode(',', array_map(static fn (string $day, int $photos): string => "$day:$photos", array_keys($shotDays), array_values($shotDays)));
	}

	/** @return array<string, int> */
	private static function decodeShotDays(mixed $value): array {
		if (!is_string($value) || $value === '') {
			return [];
		}
		$shotDays = [];
		foreach (explode(',', $value) as $pair) {
			if (preg_match('/^(\d{4}-\d{2}-\d{2}):(\d+)$/', $pair, $parts) !== 1) {
				throw new \UnexpectedValueException("Malformed folder shot days: $value");
			}
			$shotDays[$parts[1]] = (int)$parts[2];
		}
		return $shotDays;
	}

	private static function nullableInt(mixed $value): ?int {
		return $value === null ? null : (int)$value;
	}
}
