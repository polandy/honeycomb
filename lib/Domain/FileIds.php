<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain;

/** Checks the lists of file ids and items a request carries. */
final class FileIds {
	/**
	 * The request's items, if they are a list of at most `$limit`.
	 * @param array<array-key, mixed> $items
	 * @return list<mixed>
	 * @throws InvalidRequestException for anything else
	 */
	public static function items(array $items, int $limit): array {
		if (!array_is_list($items)) {
			throw InvalidRequestException::because(Reason::NotAList, 'Expected a list of items');
		}
		if (count($items) > $limit) {
			throw InvalidRequestException::because(Reason::TooMany, "Expected at most $limit items");
		}
		return $items;
	}

	/**
	 * The request's file ids, if they are a list of at most `$limit` positive integers.
	 * @param array<array-key, mixed> $fileIds
	 * @return list<int>
	 * @throws InvalidRequestException for anything else
	 */
	public static function parse(array $fileIds, int $limit): array {
		$parsed = [];
		foreach (self::items($fileIds, $limit) as $fileId) {
			if (!is_int($fileId) || $fileId < 1) {
				throw InvalidRequestException::because(Reason::BadFileId, 'fileIds must be positive integers');
			}
			$parsed[] = $fileId;
		}
		return $parsed;
	}

	/**
	 * The file ids, if each appears only once.
	 * @param list<int> $fileIds
	 * @return list<int>
	 * @throws InvalidRequestException for a file id given twice
	 */
	public static function eachOnce(array $fileIds): array {
		if (count(array_unique($fileIds)) !== count($fileIds)) {
			throw InvalidRequestException::because(Reason::Duplicate, 'Each file id may appear only once');
		}
		return $fileIds;
	}
}
