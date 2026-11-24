<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Domain\FileFlag;
use OCA\Honeycomb\Domain\Flag;
use OCA\Honeycomb\Domain\Store\FlagStore;
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
		'updated_by' => IQueryBuilder::PARAM_STR,
		'sidecar_etag' => IQueryBuilder::PARAM_STR,
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
		// Write first, so SQLite takes the write lock at once; the updated rows keep their sidecar ETag.
		$this->atomic(function () use ($flags): void {
			$this->updateFlags($flags);
			$existing = $this->find(array_map(static fn (FileFlag $flag): int => $flag->fileId, $flags));
			$this->insert(array_values(array_filter($flags, static fn (FileFlag $flag): bool => !isset($existing[$flag->fileId]))));
		}, $this->db);
	}

	#[\Override]
	public function setSidecarEtags(array $etags): array {
		return $this->atomic(function () use ($etags): array {
			foreach ($etags as $fileId => $etag) {
				$query = $this->db->getQueryBuilder();
				$query->update(self::TABLE)
					->set('sidecar_etag', $query->createNamedParameter($etag, $etag === null ? IQueryBuilder::PARAM_NULL : IQueryBuilder::PARAM_STR))
					->where($query->expr()->eq('source', $query->createNamedParameter(self::SOURCE)))
					->andWhere($query->expr()->eq('file_id', $query->createNamedParameter($fileId, IQueryBuilder::PARAM_INT)))
					->executeStatement();
			}
			return array_keys($this->find(array_keys($etags)));
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

	/** The flags stay; only the note of who decided them last is emptied (DECISIONS-001.37). */
	#[\Override]
	public function forgetUser(string $userId): void {
		$query = $this->db->getQueryBuilder();
		$query->update(self::TABLE)
			->set('updated_by', $query->createNamedParameter(null, IQueryBuilder::PARAM_NULL))
			->where($query->expr()->eq('source', $query->createNamedParameter(self::SOURCE)))
			->andWhere($query->expr()->eq('updated_by', $query->createNamedParameter($userId)))
			->executeStatement();
	}

	/** @param list<FileFlag> $flags */
	private function insert(array $flags): void {
		$this->insertRows(new InsertStatements(self::TABLE, self::COLUMNS), array_map(static fn (FileFlag $flag): array => [
			'source' => self::SOURCE,
			'file_id' => $flag->fileId,
			'flag' => $flag->flag->value,
			'keep_raw' => $flag->keepRaw,
			'updated_at' => $flag->updatedAt,
			'updated_by' => $flag->updatedBy,
			'sidecar_etag' => $flag->sidecarEtag,
		], $flags));
	}

	/**
	 * Sets the flag fields of the rows that exist, one query per state and chunk.
	 *
	 * @param list<FileFlag> $flags
	 */
	private function updateFlags(array $flags): void {
		$byState = [];
		foreach ($flags as $flag) {
			$byState[json_encode([$flag->flag->value, $flag->keepRaw, $flag->updatedAt, $flag->updatedBy], JSON_THROW_ON_ERROR)][] = $flag;
		}
		foreach ($byState as $same) {
			$state = $same[0];
			foreach (array_chunk(array_map(static fn (FileFlag $flag): int => $flag->fileId, $same), self::IN_CHUNK) as $chunk) {
				$query = $this->db->getQueryBuilder();
				$query->update(self::TABLE)
					->set('flag', $query->createNamedParameter($state->flag->value))
					->set('keep_raw', $query->createNamedParameter($state->keepRaw, IQueryBuilder::PARAM_BOOL))
					->set('updated_at', $query->createNamedParameter($state->updatedAt, IQueryBuilder::PARAM_INT))
					->set('updated_by', $query->createNamedParameter($state->updatedBy, $state->updatedBy === null ? IQueryBuilder::PARAM_NULL : IQueryBuilder::PARAM_STR))
					->where($query->expr()->eq('source', $query->createNamedParameter(self::SOURCE)))
					->andWhere($query->expr()->in('file_id', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_INT_ARRAY)))
					->executeStatement();
			}
		}
	}

	/** @param array<string, mixed> $row */
	private static function fromRow(array $row): FileFlag {
		return new FileFlag((int)$row['file_id'], Flag::from((string)$row['flag']), (bool)$row['keep_raw'], (int)$row['updated_at'], $row['updated_by'] === null ? null : (string)$row['updated_by'], $row['sidecar_etag'] === null ? null : (string)$row['sidecar_etag']);
	}
}
