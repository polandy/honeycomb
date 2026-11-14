<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\File;
use OCP\Files\Folder;
use OCP\IUser;

/** The one check whether a file id is a photo in the user's files, at a given version. */
final class UserPhotos {
	public function __construct(
		private UserFolderResolver $userFolders,
	) {
	}

	/**
	 * The file ids in `$etags` whose file the user reaches as a photo still at that etag, in the given order.
	 * @param array<int, string> $etags the etag per file id
	 * @return list<int>
	 */
	public function current(IUser $user, array $etags): array {
		if ($etags === []) {
			return [];
		}
		$userFolder = $this->userFolders->userFolder($user);
		$current = [];
		foreach ($etags as $fileId => $etag) {
			if (self::photo($userFolder, $fileId)?->getEtag() === $etag) {
				$current[] = $fileId;
			}
		}
		return $current;
	}

	private static function photo(Folder $userFolder, int $fileId): ?File {
		$node = $userFolder->getFirstNodeById($fileId);
		return $node instanceof File && ListingService::isPhoto($node) ? $node : null;
	}
}
