<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\App\IAppManager;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\IUser;
use OCP\Lock\LockedException;
use Psr\Log\LoggerInterface;

/** Moves whole pictures into the trash bin: each checked whole, then trashed file by file (ADR 0013). */
final class TrashService {
	public function __construct(
		private IRootFolder $rootFolder,
		private IAppManager $appManager,
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
		$userFolder = $this->rootFolder->getUserFolder($user->getUID());
		return array_map(fn (array $picture): array => $this->trashPicture($userFolder, $picture), $pictures);
	}

	/**
	 * @param non-empty-list<array{fileId: int, etag: string}> $picture
	 * @return list<array{fileId: int, result: TrashResult}>
	 */
	private function trashPicture(Folder $userFolder, array $picture): array {
		$checked = array_map(fn (array $file): File|TrashResult => $this->check($userFolder, $file['fileId'], $file['etag']), $picture);
		$files = array_filter($checked, static fn (File|TrashResult $node): bool => $node instanceof File);
		$results = count($files) === count($checked)
			? $this->trashInOrder($files)
			: array_map(static fn (File|TrashResult $node): TrashResult => $node instanceof File ? TrashResult::Skipped : $node, $checked);
		return array_map(static fn (array $file, TrashResult $result): array => ['fileId' => $file['fileId'], 'result' => $result], $picture, $results);
	}

	/**
	 * Trashes the image files, then the sidecars, and stops at the first failure.
	 * @param array<int, File> $files
	 * @return list<TrashResult> in the order of `$files`
	 */
	private function trashInOrder(array $files): array {
		$sidecars = array_filter($files, ListingService::isSidecar(...));
		$results = array_fill_keys(array_keys($files), TrashResult::Skipped);
		foreach (array_diff_key($files, $sidecars) + $sidecars as $index => $file) {
			$results[$index] = $this->trashFile($file);
			if ($results[$index] !== TrashResult::Trashed) {
				break;
			}
		}
		return array_values($results);
	}

	private function trashFile(File $file): TrashResult {
		try {
			$file->delete();
			return TrashResult::Trashed;
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

	/** The file to trash, or why it may not be trashed. */
	private function check(Folder $userFolder, int $fileId, string $etag): File|TrashResult {
		$node = $userFolder->getFirstNodeById($fileId);
		if (!$node instanceof File || !ListingService::isListedType($node)) {
			return TrashResult::NotFound;
		}
		if ($node->getEtag() !== $etag) {
			return TrashResult::Changed;
		}
		if (!$node->isDeletable()) {
			return TrashResult::NotPermitted;
		}
		return $node;
	}

	/**
	 * @param array<array-key, mixed> $pictures
	 * @return list<non-empty-list<array{fileId: int, etag: string}>>
	 * @throws InvalidTrashRequestException
	 */
	private function parse(array $pictures): array {
		if (!array_is_list($pictures)) {
			throw new InvalidTrashRequestException('pictures must be a list');
		}
		$seen = [];
		foreach ($pictures as $picture) {
			if (!is_array($picture) || $picture === [] || !array_is_list($picture)) {
				throw new InvalidTrashRequestException('Each picture must be a non-empty list of files');
			}
			/** @var mixed $file */
			foreach ($picture as $file) {
				$fileId = is_array($file) ? $file['fileId'] ?? null : null;
				$etag = is_array($file) ? $file['etag'] ?? null : null;
				if (!is_int($fileId) || $fileId < 1 || !is_string($etag) || $etag === '') {
					throw new InvalidTrashRequestException('Each file must have a positive fileId and an etag');
				}
				if (isset($seen[$fileId])) {
					throw new InvalidTrashRequestException("File $fileId is given twice");
				}
				$seen[$fileId] = true;
			}
		}
		if (count($seen) > ListingService::ENTRY_LIMIT) {
			throw new InvalidTrashRequestException('At most ' . ListingService::ENTRY_LIMIT . ' files');
		}
		/** @var list<non-empty-list<array{fileId: int, etag: string}>> $pictures */
		return $pictures;
	}
}
