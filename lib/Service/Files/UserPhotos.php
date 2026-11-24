<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Files;

use OCA\Honeycomb\Domain\PhotoFiles;
use OCP\Constants;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\IUser;

/** The one check whether a file id is a photo, sidecar or listed file in the user's files, at a given version. */
final class UserPhotos {
	/** The one photo type that embeds XMP the client reads (ADR 0023). */
	private const string JPEG_MIME = 'image/jpeg';
	/** A folder whose files may be flagged: XMP is written there, as a new sidecar or into the file (ADR 0039). */
	private const int RATEABLE = Constants::PERMISSION_UPDATE | Constants::PERMISSION_CREATE;

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
		$photos = $this->filesOf($user, array_keys($etags), PhotoFiles::isPhoto(...));
		return array_values(array_filter(array_keys($etags), static fn (int $fileId): bool => ($photos[$fileId] ?? null)?->getEtag() === $etags[$fileId]));
	}

	/**
	 * The file ids the user reaches as a photo, at any version, in the given order.
	 * @param list<int> $fileIds
	 * @return list<int>
	 */
	public function photos(IUser $user, array $fileIds): array {
		return $this->reached($user, $fileIds, PhotoFiles::isPhoto(...));
	}

	/**
	 * Whether the user may set the flag of each photo they reach, by file id; the rights are read once per folder.
	 * @param list<int> $fileIds
	 * @return array<int, bool>
	 */
	public function rateable(IUser $user, array $fileIds): array {
		$folderRateable = [];
		$rateable = [];
		foreach ($this->filesOf($user, $fileIds, PhotoFiles::isPhoto(...)) as $fileId => $photo) {
			$folder = dirname($photo->getPath());
			$folderRateable[$folder] ??= ($photo->getParent()->getPermissions() & self::RATEABLE) === self::RATEABLE;
			$rateable[$fileId] = $folderRateable[$folder];
		}
		return $rateable;
	}

	/** Whether the user may mark the folder done: the flag's rule, update and create (FOLDERS-006). */
	public function folderRateable(Folder $folder): bool {
		return ($folder->getPermissions() & self::RATEABLE) === self::RATEABLE;
	}

	/**
	 * The file ids the user reaches as an XMP sidecar, in the given order.
	 * @param list<int> $fileIds
	 * @return list<int>
	 */
	public function sidecars(IUser $user, array $fileIds): array {
		return $this->reached($user, $fileIds, PhotoFiles::isSidecar(...));
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
		return self::fileOf($userFolder, $fileId, PhotoFiles::isPhoto(...));
	}

	/** The JPEG with `$fileId` in `$userFolder`, or null for a missing, foreign, folder or other id. */
	public function jpeg(Folder $userFolder, int $fileId): ?File {
		return self::fileOf($userFolder, $fileId, self::isJpeg(...));
	}

	/** The XMP sidecar with `$fileId` in `$userFolder`, or null for a missing, foreign, folder or other id. */
	public function sidecar(Folder $userFolder, int $fileId): ?File {
		return self::fileOf($userFolder, $fileId, PhotoFiles::isSidecar(...));
	}

	/** The photo or sidecar with `$fileId` in `$userFolder`, or null for a missing, foreign, folder or other id. */
	public function listed(Folder $userFolder, int $fileId): ?File {
		return self::fileOf($userFolder, $fileId, PhotoFiles::isListedType(...));
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
		return PhotoFiles::isPhoto($file) && $file->getMimetype() === self::JPEG_MIME;
	}

	/** @param \Closure(File): bool $isType */
	private static function fileOf(Folder $userFolder, int $fileId, \Closure $isType): ?File {
		$node = $userFolder->getFirstNodeById($fileId);
		return $node instanceof File && $isType($node) ? $node : null;
	}
}
