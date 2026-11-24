<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Domain\ColourLabel;
use OCA\Honeycomb\Domain\Flag;
use OCA\Honeycomb\Domain\Store\XmpCacheStore;
use OCA\Honeycomb\Domain\XmpCacheRow;
use OCA\Honeycomb\Domain\XmpReadState;
use OCA\Honeycomb\Domain\XmpSource;
use OCP\AppFramework\Db\TTransactional;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\DB\QueryBuilder\IQueryFunction;
use OCP\IDBConnection;

/** Keeps the XMP cache in `honeycomb_xmp_cache`, the tags as a JSON list (ADR 0032). */
final class XmpCacheMapper implements XmpCacheStore {
	use FileRowQueries;
	use TTransactional;

	private const string TABLE = 'honeycomb_xmp_cache';
	private const array COLUMNS = [
		'user_id' => IQueryBuilder::PARAM_STR,
		'file_id' => IQueryBuilder::PARAM_INT,
		'kind' => IQueryBuilder::PARAM_STR,
		'etag' => IQueryBuilder::PARAM_STR,
		'reader' => IQueryBuilder::PARAM_INT,
		'state' => IQueryBuilder::PARAM_STR,
		'reason' => IQueryBuilder::PARAM_STR,
		'rating' => IQueryBuilder::PARAM_INT,
		'flag' => IQueryBuilder::PARAM_STR,
		'colour_label' => IQueryBuilder::PARAM_STR,
		'keep_raw' => IQueryBuilder::PARAM_BOOL,
		'tags' => IQueryBuilder::PARAM_STR,
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
	public function find(string $userId, array $fileIds): array {
		$rows = [];
		foreach ($this->findFileRows($userId, $fileIds) as $row) {
			$cached = self::rowOf($row);
			$rows[$cached->fileId] = $cached;
		}
		return $rows;
	}

	#[\Override]
	public function readCounts(string $userId): array {
		$query = $this->db->getQueryBuilder();
		$counted = static fn (string $when): IQueryFunction => $query->createFunction(sprintf('SUM(CASE WHEN %s THEN 1 ELSE 0 END)', $when));
		$flag = $query->getColumnName('flag');
		$rating = $query->getColumnName('rating');
		$query->select($query->func()->count('file_id', 'pictures'))
			->selectAlias($counted(sprintf('%s = %s', $flag, $query->createNamedParameter(Flag::Picked->value))), 'picked')
			->selectAlias($counted(sprintf('%s = %s', $flag, $query->createNamedParameter(Flag::Rejected->value))), 'rejected')
			->selectAlias($counted(sprintf('%s > 0', $rating)), 'rated')
			->from(self::TABLE)
			->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
			->andWhere($query->expr()->eq('state', $query->createNamedParameter(XmpReadState::Read->value)));
		$result = $query->executeQuery();
		/** @var array<string, mixed> $row an aggregate without grouping always answers one row */
		$row = $result->fetch();
		$result->closeCursor();
		return ['pictures' => (int)$row['pictures'], 'picked' => (int)$row['picked'], 'rejected' => (int)$row['rejected'], 'rated' => (int)$row['rated']];
	}

	/** Sorted by file id, so two saves at once take their row locks in the same order. */
	#[\Override]
	public function replace(string $userId, array $rows): void {
		usort($rows, static fn (XmpCacheRow $a, XmpCacheRow $b): int => $a->fileId <=> $b->fileId);
		$this->atomic(function () use ($userId, $rows): void {
			$this->upsertFileRows(
				$userId,
				self::COLUMNS,
				array_map(static fn (XmpCacheRow $row): array => ['user_id' => $userId, ...self::columnsOf($row)], $rows),
			);
		}, $this->db);
	}

	#[\Override]
	public function clear(?string $userId): int {
		return $this->clearRows($userId);
	}

	#[\Override]
	public function forgetUser(string $userId): void {
		$this->deleteUserRows(self::TABLE, $userId);
	}

	/** @return array<string, scalar|null> */
	private static function columnsOf(XmpCacheRow $row): array {
		return [
			'file_id' => $row->fileId,
			'kind' => $row->kind->value,
			'etag' => $row->etag,
			'reader' => $row->reader,
			'state' => $row->state->value,
			'reason' => $row->reason,
			'rating' => $row->rating,
			'flag' => $row->flag?->value,
			'colour_label' => $row->colourLabel?->value,
			'keep_raw' => $row->keepRaw,
			'tags' => $row->tags === null ? null : json_encode($row->tags, JSON_THROW_ON_ERROR),
		];
	}

	/** @param array<string, mixed> $row */
	private static function rowOf(array $row): XmpCacheRow {
		/** @var ?list<string> $tags written by `columnsOf` */
		$tags = $row['tags'] === null ? null : json_decode((string)$row['tags'], true, flags: JSON_THROW_ON_ERROR);
		return new XmpCacheRow(
			(int)$row['file_id'],
			XmpSource::from((string)$row['kind']),
			(string)$row['etag'],
			(int)$row['reader'],
			XmpReadState::from((string)$row['state']),
			$row['reason'] === null ? null : (string)$row['reason'],
			$row['rating'] === null ? null : (int)$row['rating'],
			$row['flag'] === null ? null : Flag::from((string)$row['flag']),
			$row['colour_label'] === null ? null : ColourLabel::from((string)$row['colour_label']),
			$row['keep_raw'] === null ? null : (bool)$row['keep_raw'],
			$tags,
		);
	}
}
