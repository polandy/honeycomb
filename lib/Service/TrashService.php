<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\App\IAppManager;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\IUser;
use OCP\Lock\LockedException;
use Psr\Log\LoggerInterface;

/** Moves whole pictures into the trash bin: each checked whole, then trashed file by file (ADR 0013), files of one name in different seconds (ADR 0037); a file marked permanent the trash bin would not keep is deleted for good (ADR 0036). */
final class TrashService {
	public function __construct(
		private UserPhotos $photos,
		private IAppManager $appManager,
		private TrashBinGuard $trashBinGuard,
		private TrashNameSpacing $spacing,
		private LoggerInterface $logger,
	) {
	}

	/**
	 * Trashes the files of each picture and reports each file, pictures and files in the order sent.
	 * @param array<array-key, mixed> $pictures
	 * @return list<list<array{fileId: int, result: TrashResult}>>
	 * @throws InvalidTrashRequestException for a malformed request; nothing is touched
	 * @throws TrashBinDisabledException when deleting would not be restorable; nothing is touched
	 */
	public function trash(IUser $user, array $pictures): array {
		$pictures = $this->parse($pictures);
		if (!$this->appManager->isEnabledForUser('files_trashbin', $user)) {
			throw new TrashBinDisabledException('The trash bin is disabled for the user');
		}
		$userFolder = $this->photos->userFolder($user);
		$results = [];
		while (true) {
			foreach ($pictures as $index => $picture) {
				$result = $this->trashPicture($user, $userFolder, $picture);
				if ($result !== null) {
					$results[$index] = $result;
					unset($pictures[$index]);
				}
			}
			if ($pictures === []) {
				ksort($results);
				return array_values($results);
			}
			$this->spacing->awaitNextSecond();
		}
	}

	/**
	 * The picture's results, or null when a file to trash shares a name with one trashed in this second.
	 * @param non-empty-list<array{fileId: int, etag: string, permanent: bool}> $picture
	 * @return list<array{fileId: int, result: TrashResult}>|null
	 */
	private function trashPicture(IUser $user, Folder $userFolder, array $picture): ?array {
		$checked = array_map(fn (array $file): array|TrashResult => $this->check($user, $userFolder, $file), $picture);
		/** @var array<int, array{File, TrashResult}> $files */
		$files = array_filter($checked, is_array(...));
		if (count($files) !== count($checked)) {
			$results = array_map(static fn (array|TrashResult $node): TrashResult => is_array($node) ? TrashResult::Skipped : $node, $checked);
		} elseif ($this->spacing->clear(self::namesToTrash($files))) {
			$results = $this->trashInOrder($files);
		} else {
			return null;
		}
		return array_map(static fn (array $file, TrashResult $result): array => ['fileId' => $file['fileId'], 'result' => $result], $picture, $results);
	}

	/**
	 * The names of the files that go into the trash bin rather than being deleted for good.
	 * @param array<int, array{File, TrashResult}> $files
	 * @return list<string>
	 */
	private static function namesToTrash(array $files): array {
		$toTrash = array_filter($files, static fn (array $file): bool => $file[1] === TrashResult::Trashed);
		return array_values(array_map(static fn (array $file): string => $file[0]->getName(), $toTrash));
	}

	/**
	 * Deletes the members, then the sidecars, and stops at the first failure.
	 * @param array<int, array{File, TrashResult}> $files each file with its result on success
	 * @return list<TrashResult> in the order of `$files`
	 */
	private function trashInOrder(array $files): array {
		$sidecars = array_filter($files, static fn (array $file): bool => ListingService::isSidecar($file[0]));
		$results = array_fill_keys(array_keys($files), TrashResult::Skipped);
		foreach (array_diff_key($files, $sidecars) + $sidecars as $index => [$file, $done]) {
			$results[$index] = $done === TrashResult::Trashed
				? $this->spacing->trash($file->getName(), fn (): TrashResult => $this->deleteFile($file, $done))
				: $this->deleteFile($file, $done);
			if ($results[$index] !== $done) {
				break;
			}
		}
		return array_values($results);
	}

	/** Deletes the file, which the trash bin keeps unless `$done` is `Deleted`, and returns `$done` or the failure. */
	private function deleteFile(File $file, TrashResult $done): TrashResult {
		try {
			$file->delete();
			return $done;
		} catch (NotPermittedException) {
			return TrashResult::NotPermitted;
		} catch (LockedException) {
			return TrashResult::Locked;
		} catch (NotFoundException) {
			return TrashResult::NotFound;
		} catch (\Exception $e) {
			$this->logger->warning('A file could not be moved to the trash bin', ['fileId' => $file->getId(), 'exception' => $e]);
			return TrashResult::Failed;
		}
	}

	/**
	 * The file to delete with its result on success, or why it may not be deleted.
	 * @param array{fileId: int, etag: string, permanent: bool} $file
	 * @return array{File, TrashResult}|TrashResult
	 */
	private function check(IUser $user, Folder $userFolder, array $file): array|TrashResult {
		$node = $this->photos->listed($userFolder, $file['fileId']);
		if ($node === null) {
			return TrashResult::NotFound;
		}
		if ($node->getEtag() !== $file['etag']) {
			return TrashResult::Changed;
		}
		if (!$node->isDeletable()) {
			return TrashResult::NotPermitted;
		}
		$refusal = $this->trashBinGuard->refusal($user->getUID(), $node);
		if ($refusal === null) {
			return [$node, TrashResult::Trashed];
		}
		return $file['permanent'] ? [$node, TrashResult::Deleted] : $refusal;
	}

	/**
	 * @param array<array-key, mixed> $pictures
	 * @return list<non-empty-list<array{fileId: int, etag: string, permanent: bool}>>
	 * @throws InvalidTrashRequestException
	 */
	private function parse(array $pictures): array {
		if (!array_is_list($pictures)) {
			throw new InvalidTrashRequestException('pictures must be a list');
		}
		$fileIds = [];
		$parsed = [];
		foreach ($pictures as $picture) {
			if (!is_array($picture) || $picture === [] || !array_is_list($picture)) {
				throw new InvalidTrashRequestException('Each picture must be a non-empty list of files');
			}
			$files = [];
			/** @var mixed $file */
			foreach ($picture as $file) {
				$fileId = is_array($file) ? $file['fileId'] ?? null : null;
				$etag = is_array($file) ? $file['etag'] ?? null : null;
				$permanent = is_array($file) ? $file['permanent'] ?? false : false;
				if (!is_int($fileId) || $fileId < 1 || !is_string($etag) || $etag === '' || !is_bool($permanent)) {
					throw new InvalidTrashRequestException('Each file must have a positive fileId, an etag and at most a boolean permanent');
				}
				$fileIds[] = $fileId;
				$files[] = ['fileId' => $fileId, 'etag' => $etag, 'permanent' => $permanent];
			}
			$parsed[] = $files;
		}
		FileIds::eachOnce($fileIds, InvalidTrashRequestException::class);
		if (count($fileIds) > PictureRequestLimit::FILES) {
			throw new InvalidTrashRequestException('At most ' . PictureRequestLimit::FILES . ' files');
		}
		/** @var list<non-empty-list<array{fileId: int, etag: string, permanent: bool}>> $parsed */
		return $parsed;
	}
}
