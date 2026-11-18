<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\IUser;

/** The one check whether a file id is a photo, sidecar or listed file in the user's files, at a given version. */
final class UserPhotos {
	/** The one photo type that embeds XMP the client reads (ADR 0023). */
	private const string JPEG_MIME = 'image/jpeg';

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
		$photos = $this->filesOf($user, array_keys($etags), ListingService::isPhoto(...));
		return array_values(array_filter(array_keys($etags), static fn (int $fileId): bool => ($photos[$fileId] ?? null)?->getEtag() === $etags[$fileId]));
	}

	/**
	 * The file ids the user reaches as a photo, at any version, in the given order.
	 * @param list<int> $fileIds
	 * @return list<int>
	 */
	public function photos(IUser $user, array $fileIds): array {
		return $this->reached($user, $fileIds, ListingService::isPhoto(...));
	}

	/**
	 * The file ids the user reaches as an XMP sidecar, in the given order.
	 * @param list<int> $fileIds
	 * @return list<int>
	 */
	public function sidecars(IUser $user, array $fileIds): array {
		return $this->reached($user, $fileIds, ListingService::isSidecar(...));
	}

	/**
	 * The file ids the user reaches as a JPEG, in the given order.
	 * @param list<int> $fileIds
	 * @return list<int>
	 */
	public function jpegs(IUser $user, array $fileIds): array {
		return $this->reached($user, $fileIds, self::isJpeg(...));
	}

	/** The user's folder, to look up many file ids in one request. */
	public function userFolder(IUser $user): Folder {
		return $this->userFolders->userFolder($user);
	}

	/** The photo with `$fileId` in `$userFolder`, or null for a missing, foreign, folder or other id. */
	public function photo(Folder $userFolder, int $fileId): ?File {
		return self::fileOf($userFolder, $fileId, ListingService::isPhoto(...));
	}

	/** The JPEG with `$fileId` in `$userFolder`, or null for a missing, foreign, folder or other id. */
	public function jpeg(Folder $userFolder, int $fileId): ?File {
		return self::fileOf($userFolder, $fileId, self::isJpeg(...));
	}

	/** The XMP sidecar with `$fileId` in `$userFolder`, or null for a missing, foreign, folder or other id. */
	public function sidecar(Folder $userFolder, int $fileId): ?File {
		return self::fileOf($userFolder, $fileId, ListingService::isSidecar(...));
	}

	/** The photo or sidecar with `$fileId` in `$userFolder`, or null for a missing, foreign, folder or other id. */
	public function listed(Folder $userFolder, int $fileId): ?File {
		return self::fileOf($userFolder, $fileId, ListingService::isListedType(...));
	}

	/**
	 * @param list<int> $fileIds
	 * @param \Closure(File): bool $isType
	 * @return list<int>
	 */
	private function reached(IUser $user, array $fileIds, \Closure $isType): array {
		$files = $this->filesOf($user, $fileIds, $isType);
		return array_values(array_filter($fileIds, static fn (int $fileId): bool => isset($files[$fileId])));
	}

	/**
	 * The files of `$isType` among `$fileIds` the user reaches, by file id, searched 1,000 ids at a time (ADR 0038).
	 * @param list<int> $fileIds
	 * @param \Closure(File): bool $isType
	 * @return array<int, File>
	 */
	private function filesOf(IUser $user, array $fileIds, \Closure $isType): array {
		if ($fileIds === []) {
			return [];
		}
		$userFolder = $this->userFolder($user);
		$files = [];
		foreach (array_chunk($fileIds, IQueryBuilder::MAX_IN_PARAMETERS) as $chunk) {
			foreach ($userFolder->search(new FileIdSearch($user, $chunk)) as $node) {
				if ($node instanceof File && !isset($files[$node->getId()]) && $isType($node)) {
					$files[$node->getId()] = $node;
				}
			}
		}
		return $files;
	}

	private static function isJpeg(File $file): bool {
		return ListingService::isPhoto($file) && $file->getMimetype() === self::JPEG_MIME;
	}

	/** @param \Closure(File): bool $isType */
	private static function fileOf(Folder $userFolder, int $fileId, \Closure $isType): ?File {
		$node = $userFolder->getFirstNodeById($fileId);
		return $node instanceof File && $isType($node) ? $node : null;
	}
}
