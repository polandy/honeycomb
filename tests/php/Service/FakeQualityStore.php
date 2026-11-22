<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\QualityStore;
use OCA\Honeycomb\Service\QualityValue;
use OCP\DB\Exception as DbException;

/** Keeps quality values in memory, by file id. */
final class FakeQualityStore implements QualityStore {
	use FakeRowsByFile;
	use FakeSharedCacheRows;

	/** @var array<int, QualityValue> */
	public array $rows = [];

	/** @var list<list<int>> The file ids of each `find()` call. */
	public array $findCalls = [];
	/** @var int How many `replace()` calls still fail, as a concurrent save winning the insert would. */
	public int $failures = 0;
	/** @var int How many times `replace()` was called, failed ones included. */
	public int $replaceCalls = 0;

	#[\Override]
	public function find(array $fileIds): array {
		$this->findCalls[] = $fileIds;
		return array_intersect_key($this->rows, array_flip($fileIds));
	}

	#[\Override]
	public function replace(array $values): void {
		++$this->replaceCalls;
		if ($this->failures > 0) {
			--$this->failures;
			throw new FakeDbException(DbException::REASON_UNIQUE_CONSTRAINT_VIOLATION);
		}
		foreach ($values as $row) {
			$this->rows[$row->fileId] = $row;
		}
	}

	/** The row moved to `$fileId`. */
	private static function movedTo(QualityValue $row, int $fileId): QualityValue {
		return new QualityValue($fileId, $row->etag, $row->method, $row->sharpness, $row->focusTile);
	}
}
