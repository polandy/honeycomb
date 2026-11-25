<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Folder;

use OCA\Honeycomb\Domain\FileIds;
use OCA\Honeycomb\Domain\InvalidRequestException;
use OCA\Honeycomb\Domain\Limits;
use OCA\Honeycomb\Domain\Reason;

/** Checks the bodies of the done writes before any folder is looked up (FOLDERS-006). */
final class FolderDoneRequest {
	/**
	 * The photos a folder is marked done with, a whole number from 0.
	 * @throws InvalidRequestException for anything else
	 */
	public static function photos(mixed $photos): int {
		if (!is_int($photos) || $photos < 0) {
			throw InvalidRequestException::because(Reason::BadValue, 'photos must be a whole number from 0');
		}
		return $photos;
	}

	/**
	 * The photos of each folder of a *Mark all done*, by file id in the request's order.
	 * @return array<int, int>
	 * @throws InvalidRequestException for a malformed list, item or file id, or one given twice
	 */
	public static function marks(mixed $folders): array {
		$marks = [];
		foreach (FileIds::items(self::list($folders), Limits::REQUEST_FOLDERS) as $item) {
			if (!is_array($item)) {
				throw InvalidRequestException::because(Reason::NotAnObject, 'Each folder must be an object');
			}
			$fileId = FileIds::parse([$item['fileId'] ?? null], 1)[0];
			if (isset($marks[$fileId])) {
				throw InvalidRequestException::because(Reason::Duplicate, 'Each file id may appear only once');
			}
			$marks[$fileId] = self::photos($item['photos'] ?? null);
		}
		return $marks;
	}

	/**
	 * The file ids of a *Reopen all*.
	 * @return list<int>
	 * @throws InvalidRequestException for a malformed list or file id, or one given twice
	 */
	public static function fileIds(mixed $fileIds): array {
		return FileIds::eachOnce(FileIds::parse(self::list($fileIds), Limits::REQUEST_FOLDERS));
	}

	/**
	 * @return array<array-key, mixed>
	 * @throws InvalidRequestException when the body carries no list
	 */
	private static function list(mixed $items): array {
		if (!is_array($items)) {
			throw InvalidRequestException::because(Reason::NotAList, 'Expected a list of folders');
		}
		return $items;
	}
}
