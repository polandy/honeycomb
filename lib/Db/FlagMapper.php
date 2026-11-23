<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Service\FileFlag;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\FlagStore;
use OCP\AppFramework\Db\TTransactional;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/** Keeps the one flag of each file as a file row of `honeycomb_decisions`, without a user (ADR 0040, 0054). */
final class FlagMapper implements FlagStore {
	use FileRowQueries;
	use TTransactional;

	private const string TABLE = 'honeycomb_decisions';
	private const string SOURCE = 'file';
	private const array COLUMNS = [
		'source' => IQueryBuilder::PARAM_STR,
		'file_id' => IQueryBuilder::PARAM_INT,
		'flag' => IQueryBuilder::PARAM_STR,
		'keep_raw' => IQueryBuilder::PARAM_BOOL,
		'updated_at' => IQueryBuilder::PARAM_INT,
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
		$flags = [];
		foreach ($this->findFileRows(null, $fileIds) as $row) {
			$flag = self::fromRow($row);
			$flags[$flag->fileId] = $flag;
		}
		return $flags;
	}

	#[\Override]
	public function save(array $flags): void {
		$this->atomic(function () use ($flags): void {
			$this->deleteFileRows(null, array_map(static fn (FileFlag $flag): int => $flag->fileId, $flags));
			$this->insert($flags);
		}, $this->db);
	}

	#[\Override]
	public function takeOver(array $flags): array {
		// Read before the transaction, so SQLite takes the write lock at once; a row inserted meanwhile hits the unique key, and FlagService repeats the take-over.
		$existing = $this->find(array_map(static fn (FileFlag $flag): int => $flag->fileId, $flags));
		$missing = array_values(array_filter($flags, static fn (FileFlag $flag): bool => !isset($existing[$flag->fileId])));
		$this->atomic(fn () => $this->insert($missing), $this->db);
		return array_map(static fn (FileFlag $flag): int => $flag->fileId, $missing);
	}

	#[\Override]
	public function remove(array $fileIds): void {
		$this->deleteFileRows(null, $fileIds);
	}

	/** A file's one flag follows it to the new file id, whoever set it. */
	#[\Override]
	public function carryOver(string $userId, int $fileId, int $newFileId): void {
		$this->carryFileRow($fileId, $newFileId);
	}

	/** @param list<FileFlag> $flags */
	private function insert(array $flags): void {
		$this->insertRows(new InsertStatements(self::TABLE, self::COLUMNS), array_map(static fn (FileFlag $flag): array => [
			'source' => self::SOURCE,
			'file_id' => $flag->fileId,
			'flag' => $flag->flag->value,
			'keep_raw' => $flag->keepRaw,
			'updated_at' => $flag->updatedAt,
		], $flags));
	}

	/** @param array<string, mixed> $row */
	private static function fromRow(array $row): FileFlag {
		return new FileFlag((int)$row['file_id'], Flag::from((string)$row['flag']), (bool)$row['keep_raw'], (int)$row['updated_at']);
	}
}
