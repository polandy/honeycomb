<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Checks the lists of file ids and items a request carries; each caller names the exception its controller maps. */
final class FileIds {
	/**
	 * The request's items, if they are a list of at most `$limit`.
	 * @param array<array-key, mixed> $items
	 * @param class-string<InvalidRequestException> $invalid
	 * @return list<mixed>
	 * @throws InvalidRequestException of class `$invalid` for anything else
	 */
	public static function items(array $items, int $limit, string $invalid): array {
		if (!array_is_list($items) || count($items) > $limit) {
			throw new $invalid("Expected a list of at most $limit items");
		}
		return $items;
	}

	/**
	 * The request's file ids, if they are a list of at most `$limit` positive integers.
	 * @param array<array-key, mixed> $fileIds
	 * @param class-string<InvalidRequestException> $invalid
	 * @return list<int>
	 * @throws InvalidRequestException of class `$invalid` for anything else
	 */
	public static function parse(array $fileIds, int $limit, string $invalid): array {
		$parsed = [];
		foreach (self::items($fileIds, $limit, $invalid) as $fileId) {
			if (!is_int($fileId) || $fileId < 1) {
				throw new $invalid('fileIds must be positive integers');
			}
			$parsed[] = $fileId;
		}
		return $parsed;
	}

	/**
	 * The file ids, if each appears only once.
	 * @param list<int> $fileIds
	 * @param class-string<InvalidRequestException> $invalid
	 * @return list<int>
	 * @throws InvalidRequestException of class `$invalid` for a file id given twice
	 */
	public static function eachOnce(array $fileIds, string $invalid): array {
		if (count(array_unique($fileIds)) !== count($fileIds)) {
			throw new $invalid('Each file id may appear only once');
		}
		return $fileIds;
	}
}
