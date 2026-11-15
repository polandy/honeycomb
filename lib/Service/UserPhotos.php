<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\File;
use OCP\Files\Folder;
use OCP\IUser;

/** The one check whether a file id is a photo, sidecar or listed file in the user's files, at a given version. */
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
		$userFolder = $this->userFolder($user);
		$current = [];
		foreach ($etags as $fileId => $etag) {
			if ($this->photo($userFolder, $fileId)?->getEtag() === $etag) {
				$current[] = $fileId;
			}
		}
		return $current;
	}

	/**
	 * The file ids the user reaches as a photo, at any version, in the given order.
	 * @param list<int> $fileIds
	 * @return list<int>
	 */
	public function photos(IUser $user, array $fileIds): array {
		if ($fileIds === []) {
			return [];
		}
		$userFolder = $this->userFolder($user);
		return array_values(array_filter($fileIds, fn (int $fileId): bool => $this->photo($userFolder, $fileId) !== null));
	}

	/** The user's folder, to look up many file ids in one request. */
	public function userFolder(IUser $user): Folder {
		return $this->userFolders->userFolder($user);
	}

	/** The photo with `$fileId` in `$userFolder`, or null for a missing, foreign, folder or other id. */
	public function photo(Folder $userFolder, int $fileId): ?File {
		return self::fileOf($userFolder, $fileId, ListingService::isPhoto(...));
	}

	/** The XMP sidecar with `$fileId` in `$userFolder`, or null for a missing, foreign, folder or other id. */
	public function sidecar(Folder $userFolder, int $fileId): ?File {
		return self::fileOf($userFolder, $fileId, ListingService::isSidecar(...));
	}

	/** The photo or sidecar with `$fileId` in `$userFolder`, or null for a missing, foreign, folder or other id. */
	public function listed(Folder $userFolder, int $fileId): ?File {
		return self::fileOf($userFolder, $fileId, ListingService::isListedType(...));
	}

	/** @param \Closure(File): bool $isType */
	private static function fileOf(Folder $userFolder, int $fileId, \Closure $isType): ?File {
		$node = $userFolder->getFirstNodeById($fileId);
		return $node instanceof File && $isType($node) ? $node : null;
	}
}
