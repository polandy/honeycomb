<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Domain\QualityValue;
use OCA\Honeycomb\Domain\Store\QualityStore;
use OCP\AppFramework\Db\TTransactional;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/** Keeps the one quality value of each file in `honeycomb_quality`, without a user (ADR 0046). */
final class QualityMapper implements QualityStore {
	use FileRowQueries;
	use TTransactional;

	private const string TABLE = 'honeycomb_quality';
	private const array COLUMNS = [
		'file_id' => IQueryBuilder::PARAM_INT,
		'etag' => IQueryBuilder::PARAM_STR,
		'method' => IQueryBuilder::PARAM_INT,
		'sharpness' => IQueryBuilder::PARAM_STR,
		'focus_tile' => IQueryBuilder::PARAM_INT,
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
		$values = [];
		foreach ($this->findFileRows(null, $fileIds) as $row) {
			$value = new QualityValue((int)$row['file_id'], (string)$row['etag'], (int)$row['method'], (float)$row['sharpness'], (int)$row['focus_tile']);
			$values[$value->fileId] = $value;
		}
		return $values;
	}

	/** Sorted by file id, so two saves at once take their row locks in the same order. */
	#[\Override]
	public function replace(array $values): void {
		usort($values, static fn (QualityValue $a, QualityValue $b): int => $a->fileId <=> $b->fileId);
		$this->atomic(function () use ($values): void {
			$this->upsertFileRows(null, self::COLUMNS, array_map(static fn (QualityValue $value): array => [
				'file_id' => $value->fileId,
				'etag' => $value->etag,
				'method' => $value->method,
				'sharpness' => $value->sharpness,
				'focus_tile' => $value->focusTile,
			], $values));
		}, $this->db);
	}

	#[\Override]
	public function clearAll(): int {
		return $this->clearRows(null);
	}
}
