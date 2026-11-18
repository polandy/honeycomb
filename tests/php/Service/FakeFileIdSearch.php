<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCP\Files\Node;
use OCP\Files\Search\ISearchComparison;
use OCP\Files\Search\ISearchQuery;

/** A stubbed `Folder::search()` for the file id search of `UserPhotos` (ADR 0038). */
trait FakeFileIdSearch {
	/**
	 * A `search` answer that finds each searched file id through `$byId`; the ids of each search land in `$searched`.
	 * @param \Closure(int): ?Node $byId
	 * @param list<list<int>> $searched
	 * @return \Closure(ISearchQuery): list<Node>
	 */
	private static function fileIdSearch(\Closure $byId, array &$searched = []): \Closure {
		return static function (ISearchQuery $query) use ($byId, &$searched): array {
			$in = $query->getSearchOperation();
			self::assertInstanceOf(ISearchComparison::class, $in);
			self::assertSame([ISearchComparison::COMPARE_IN, 'fileid', 0], [$in->getType(), $in->getField(), $query->getLimit()]);
			/** @var list<int> $fileIds */
			$fileIds = $in->getValue();
			$searched[] = $fileIds;
			return array_values(array_filter(array_map($byId, $fileIds)));
		};
	}
}
