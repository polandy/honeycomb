<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Service\VisualHash;
use OCA\Honeycomb\Service\VisualHashStore;
use OCP\AppFramework\Db\TTransactional;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/** Keeps the one visual hash of each file in `honeycomb_hashes`, without a user (ADR 0024, ADR 0046). */
final class VisualHashMapper implements VisualHashStore {
	use FileRowQueries;
	use TTransactional;

	private const string TABLE = 'honeycomb_hashes';
	private const array COLUMNS = [
		'file_id' => IQueryBuilder::PARAM_INT,
		'etag' => IQueryBuilder::PARAM_STR,
		'method' => IQueryBuilder::PARAM_INT,
		'hash' => IQueryBuilder::PARAM_STR,
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
		$hashes = [];
		foreach ($this->findFileRows(null, $fileIds) as $row) {
			$hash = new VisualHash((int)$row['file_id'], (string)$row['etag'], (int)$row['method'], (string)$row['hash']);
			$hashes[$hash->fileId] = $hash;
		}
		return $hashes;
	}

	/** Sorted by file id, so two saves at once take their row locks in the same order. */
	#[\Override]
	public function replace(array $hashes): void {
		usort($hashes, static fn (VisualHash $a, VisualHash $b): int => $a->fileId <=> $b->fileId);
		$this->atomic(function () use ($hashes): void {
			$this->upsertFileRows(
				null,
				self::COLUMNS,
				array_map(static fn (VisualHash $hash): array => ['file_id' => $hash->fileId, 'etag' => $hash->etag, 'method' => $hash->method, 'hash' => $hash->hash], $hashes),
			);
		}, $this->db);
	}

	#[\Override]
	public function clearAll(): int {
		return $this->clearRows(null);
	}
}
