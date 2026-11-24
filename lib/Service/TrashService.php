<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\App\IAppManager;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\GenericFileException;
use OCP\Files\InvalidPathException;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\Files\StorageNotAvailableException;
use OCP\IUser;
use OCP\Lock\LockedException;
use Psr\Log\LoggerInterface;

/** Moves whole pictures into the trash bin: each checked whole, also against its flag rows, then trashed file by file (ADR 0013, ADR 0040), files of one name in different seconds (ADR 0037); a file marked permanent the trash bin would not keep is deleted for good (ADR 0036); what was deleted is counted (STATS-001). */
final class TrashService {
	public function __construct(
		private UserPhotos $photos,
		private IAppManager $appManager,
		private TrashBinGuard $trashBinGuard,
		private TrashNameSpacing $spacing,
		private FlagStore $flags,
		private LoggerInterface $logger,
		private StatsService $stats,
	) {
	}

	/**
	 * Trashes the files of each picture whose rows still say `$expect`, removes the rows of the files deleted and reports each file, pictures and files in the order sent.
	 * @param array<array-key, mixed> $pictures
	 * @return list<list<array{fileId: int, result: TrashResult}>>
	 * @throws InvalidTrashRequestException for a malformed request; nothing is touched
	 * @throws TrashBinDisabledException when deleting would not be restorable; nothing is touched
	 * @throws \OCP\DB\Exception when the rows cannot be read; nothing is touched
	 */
	public function trash(IUser $user, array $pictures, mixed $expect = null): array {
		$pictures = $this->parse($pictures);
		$expectation = self::expectation($expect);
		if (!$this->appManager->isEnabledForUser('files_trashbin', $user)) {
			throw new TrashBinDisabledException('The trash bin is disabled for the user');
		}
		$userFolder = $this->photos->userFolder($user);
		$rows = $expectation === null ? [] : $this->flags->find(array_merge(...array_map(static fn (array $picture): array => array_column($picture, 'fileId'), $pictures)));
		$tally = new TrashTally($expectation === TrashExpectation::RawRemovable);
		$results = [];
		while (true) {
			foreach ($pictures as $index => $picture) {
				$result = $this->trashPicture($user, $userFolder, $picture, $expectation, $rows, $tally);
				if ($result !== null) {
					$results[$index] = $result;
					unset($pictures[$index]);
				}
			}
			if ($pictures === []) {
				ksort($results);
				$this->removeRows(array_merge(...$results));
				$this->stats->count($user, ...$tally->counts());
				return array_values($results);
			}
			$this->spacing->awaitNextSecond();
		}
	}

	/**
	 * Removes the rows of the files deleted; the files are gone, so a failure only leaves rows the clean-up removes.
	 * @param list<array{fileId: int, result: TrashResult}> $results
	 */
	private function removeRows(array $results): void {
		$deleted = array_filter($results, static fn (array $file): bool => in_array($file['result'], [TrashResult::Trashed, TrashResult::Deleted], true));
		if ($deleted === []) {
			return;
		}
		try {
			$this->flags->remove(array_column($deleted, 'fileId'));
		} catch (\OCP\DB\Exception $e) {
			$this->logger->error('Could not remove the flag rows of trashed files', ['exception' => $e]);
		}
	}

	/** @throws InvalidTrashRequestException */
	private static function expectation(mixed $expect): ?TrashExpectation {
		if ($expect === null) {
			return null;
		}
		$expectation = is_string($expect) ? TrashExpectation::tryFrom($expect) : null;
		if ($expectation === null) {
			throw new InvalidTrashRequestException('expect must be rejected or rawRemovable');
		}
		return $expectation;
	}

	/**
	 * The picture's results, added to `$tally`, or null when a file to trash shares a name with one trashed in this second.
	 * @param non-empty-list<array{fileId: int, etag: string, permanent: bool}> $picture
	 * @param array<int, FileFlag> $rows
	 * @return list<array{fileId: int, result: TrashResult}>|null
	 */
	private function trashPicture(IUser $user, Folder $userFolder, array $picture, ?TrashExpectation $expectation, array $rows, TrashTally $tally): ?array {
		$checked = array_map(fn (array $file): array|TrashResult => $this->check($user, $userFolder, $file), $picture);
		/** @var list<array{File, TrashResult}> $files */
		$files = array_filter($checked, is_array(...));
		if (count($files) !== count($checked)) {
			$results = array_map(static fn (array|TrashResult $node): TrashResult => is_array($node) ? TrashResult::Skipped : $node, $checked);
		} elseif ($expectation !== null && !$expectation->holds(self::memberRows($files, $picture, $rows))) {
			$results = array_fill(0, count($picture), TrashResult::DecisionChanged);
		} elseif ($this->spacing->clear(self::namesToTrash($files))) {
			$sizes = array_map($this->size(...), array_column($files, 0));
			$results = $this->trashInOrder($user, $files);
			$tally->add($files, $results, $sizes);
		} else {
			return null;
		}
		return array_map(static fn (array $file, TrashResult $result): array => ['fileId' => $file['fileId'], 'result' => $result], $picture, $results);
	}

	/**
	 * The rows of the picture's members by the file ids sent, null for a member without one.
	 * @param array<int, array{File, TrashResult}> $files
	 * @param non-empty-list<array{fileId: int, etag: string, permanent: bool}> $picture
	 * @param array<int, FileFlag> $rows
	 * @return list<?FileFlag>
	 */
	private static function memberRows(array $files, array $picture, array $rows): array {
		$members = array_filter($files, static fn (array $file): bool => !ListingService::isSidecar($file[0]));
		return array_map(static fn (int $index): ?FileFlag => $rows[$picture[$index]['fileId']] ?? null, array_keys($members));
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
	private function trashInOrder(IUser $user, array $files): array {
		$sidecars = array_filter($files, static fn (array $file): bool => ListingService::isSidecar($file[0]));
		$results = array_fill_keys(array_keys($files), TrashResult::Skipped);
		foreach (array_diff_key($files, $sidecars) + $sidecars as $index => [$file, $done]) {
			$results[$index] = $done === TrashResult::Trashed
				? $this->spacing->trash($file->getName(), fn (): TrashResult => $this->deleteFile($user, $file, $done))
				: $this->deleteFile($user, $file, $done);
			if ($results[$index] !== $done) {
				break;
			}
		}
		return array_values($results);
	}

	/** The file's size for the statistics, 0 when it cannot be read, so the delete goes on. */
	private function size(File $file): int {
		try {
			return (int)$file->getSize();
		} catch (GenericFileException|InvalidPathException|StorageNotAvailableException|NotPermittedException|LockedException|NotFoundException $e) {
			// Statistics are best effort; the delete must not fail for them.
			$this->logger->warning('Could not read the size of a file to count it', ['fileId' => $file->getId(), 'exception' => $e]);
			return 0;
		}
	}

	/** Deletes the file, which the trash bin keeps unless `$done` is `Deleted`, and returns `$done` or the failure; a delete for good is logged without the path (DELETE-001.14). */
	private function deleteFile(IUser $user, File $file, TrashResult $done): TrashResult {
		$fileId = $file->getId();
		try {
			$file->delete();
			if ($done === TrashResult::Deleted) {
				$this->logger->warning('A file was deleted permanently', ['fileId' => $fileId, 'user' => $user->getUID()]);
			}
			return $done;
		} catch (NotPermittedException) {
			return TrashResult::NotPermitted;
		} catch (LockedException) {
			return TrashResult::Locked;
		} catch (NotFoundException) {
			return TrashResult::NotFound;
		} catch (GenericFileException|InvalidPathException|StorageNotAvailableException $e) {
			$this->logger->warning('A file could not be moved to the trash bin', ['fileId' => $fileId, 'exception' => $e]);
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
