<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\App\IAppManager;
use OCP\DB\Exception as DbException;
use OCP\Files\AlreadyExistsException;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\GenericFileException;
use OCP\Files\InvalidPathException;
use OCP\Files\Node;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\Files\StorageNotAvailableException;
use OCP\IUser;
use OCP\Lock\LockedException;
use Psr\Log\LoggerInterface;

/**
 * Moves whole pictures to the paths the client rendered, within their storage: each checked whole, moved file by file
 * and moved back when one of its files fails (ADR 0018); a file is replaced into the trash bin, or for good once the user confirmed (ADR 0036, ADR 0048); every user's rows follow a new file id in one transaction (MOVE-002.10);
 * the pictures moved whole are counted (STATS-001.31).
 *
 * @psalm-type Outcome = array{fileId: int, result: MoveResult, replaced: bool, path?: string, newFileId?: int, etag?: string}
 */
final class MoveService {
	public function __construct(
		private UserPhotos $photos,
		private IAppManager $appManager,
		private FileRowCarryOver $fileRows,
		private LoggerInterface $logger,
		private StatsService $stats,
		private TrashBinGuard $trashBin,
	) {
	}

	/**
	 * Moves the files of each picture and reports each file, pictures and files in the order sent.
	 * @param array<array-key, mixed> $pictures
	 * @return list<list<Outcome>>
	 * @throws InvalidRequestException for a malformed request; nothing is touched
	 * @throws TrashBinDisabledException when a replace would not be restorable; nothing is touched
	 */
	public function move(IUser $user, array $pictures): array {
		$pictures = MoveRequest::pictures($pictures);
		$replaces = array_filter(array_merge(...$pictures), static fn (MoveFile $file): bool => $file->replaceFileId !== null);
		if ($replaces !== [] && !$this->appManager->isEnabledForUser('files_trashbin', $user)) {
			throw new TrashBinDisabledException('The trash bin is disabled for the user');
		}
		$userFolder = $this->photos->userFolder($user);
		$results = array_map(fn (array $picture): array => $this->movePicture($user->getUID(), $userFolder, $picture), $pictures);
		$moved = array_filter($results, static fn (array $outcomes): bool => array_filter($outcomes, static fn (array $outcome): bool => $outcome['result'] !== MoveResult::Moved) === []);
		$this->stats->count($user, new StatsCount(StatsMetric::PicturesMoved, count($moved)));
		return $results;
	}

	/**
	 * @param non-empty-list<MoveFile> $picture
	 * @return list<Outcome>
	 */
	private function movePicture(string $userId, Folder $userFolder, array $picture): array {
		$checked = array_map(fn (MoveFile $file): CheckedMove|MoveResult => $this->check($userId, $userFolder, $file), $picture);
		$moves = array_filter($checked, static fn (CheckedMove|MoveResult $move): bool => $move instanceof CheckedMove);
		if (count($moves) !== count($checked)) {
			return array_map(static fn (MoveFile $file, CheckedMove|MoveResult $move): array => [
				'fileId' => $file->fileId,
				'result' => $move instanceof MoveResult ? $move : MoveResult::Skipped,
				'replaced' => false,
			], $picture, $checked);
		}
		$outcomes = $this->moveInOrder($userId, $userFolder, $moves);
		return array_map(static fn (MoveFile $file, array $outcome): array => ['fileId' => $file->fileId] + $outcome, $picture, $outcomes);
	}

	/**
	 * Moves the members, then the sidecars; at the first failure the moved files go back, last first.
	 * @param array<int, CheckedMove> $moves
	 * @return list<array{result: MoveResult, replaced: bool, path?: string, newFileId?: int, etag?: string}> in the order of `$moves`
	 */
	private function moveInOrder(string $userId, Folder $userFolder, array $moves): array {
		$sidecars = array_filter($moves, static fn (CheckedMove $move): bool => PhotoFiles::isSidecar($move->source));
		$outcomes = array_fill_keys(array_keys($moves), ['result' => MoveResult::Skipped, 'replaced' => false]);
		/** @var array<int, Node> $moved */
		$moved = [];
		foreach (array_diff_key($moves, $sidecars) + $sidecars as $index => $move) {
			$replaced = false;
			try {
				$moved[$index] = $this->moveFile($userId, $userFolder, $move, $replaced);
				$this->carryOver($move->source->getId(), $moved[$index]);
				$outcomes[$index] = self::moved($move, $moved[$index], $replaced);
			} catch (GenericFileException|InvalidPathException|StorageNotAvailableException|AlreadyExistsException|DbException|NotPermittedException|LockedException|NotFoundException $e) {
				$outcomes[$index] = ['result' => $this->failure($e, $move->source), 'replaced' => $replaced];
				$outcomes = $this->rollBack($moved, $moves, $outcomes);
				break;
			} catch (\Throwable $e) {
				// A bug must not strand the moved files, so they go back before it escapes.
				$this->rollBack($moved, $moves, $outcomes);
				throw $e;
			}
		}
		return array_values($outcomes);
	}

	/**
	 * @param array<int, Node> $moved
	 * @param array<int, CheckedMove> $moves
	 * @param array<int, array{result: MoveResult, replaced: bool, path?: string, newFileId?: int, etag?: string}> $outcomes
	 * @return array<int, array{result: MoveResult, replaced: bool, path?: string, newFileId?: int, etag?: string}>
	 */
	private function rollBack(array $moved, array $moves, array $outcomes): array {
		foreach (array_reverse($moved, true) as $back => $node) {
			$outcomes[$back] = $this->moveBack($node, $moves[$back]) ? ['result' => MoveResult::MovedBack, 'replaced' => $outcomes[$back]['replaced']] : $outcomes[$back];
		}
		return $outcomes;
	}

	/**
	 * Creates the missing folders, trashes the file to replace, or deletes it for good logged without its path, and moves the file into its place.
	 * @param-out bool $replaced
	 */
	private function moveFile(string $userId, Folder $userFolder, CheckedMove $move, bool &$replaced): Node {
		if ($move->stays) {
			return $move->source;
		}
		$folder = $userFolder;
		foreach (self::segments(dirname($move->path)) as $name) {
			$folder = $this->subfolder($folder, $name);
		}
		if ($move->replace !== null) {
			$fileId = $move->replace->getId();
			$move->replace->delete();
			$replaced = true;
			if ($move->replacesForGood) {
				$this->logger->warning('A file was replaced permanently', ['fileId' => $fileId, 'user' => $userId]);
			}
		}
		return $move->source->move($userFolder->getPath() . $move->path);
	}

	private function subfolder(Folder $folder, string $name): Folder {
		try {
			$node = $folder->get($name);
		} catch (NotFoundException) {
			return $folder->newFolder($name);
		}
		return $node instanceof Folder ? $node : throw new AlreadyExistsException("$name is not a folder");
	}

	private function moveBack(Node $node, CheckedMove $move): bool {
		if ($move->stays) {
			return true;
		}
		try {
			$this->carryOver($node->getId(), $node->move($move->from));
			return true;
		} catch (GenericFileException|InvalidPathException|StorageNotAvailableException|NotPermittedException|LockedException|NotFoundException|AlreadyExistsException $e) {
			$this->logger->warning('A moved file could not be moved back', ['fileId' => $node->getId(), 'exception' => $e]);
			return false;
		}
	}

	/** Carries every user's rows of the file over when the move gave it a new id; a failure leaves them all, is logged and the file stays moved. */
	private function carryOver(int $fileId, Node $node): void {
		$newFileId = $node->getId();
		if ($newFileId === $fileId) {
			return;
		}
		try {
			$this->fileRows->carryOver($fileId, $newFileId);
		} catch (DbException $e) {
			// A move is not undone for lost rows.
			$this->logger->error('The rows of a file could not follow it to a new file id', ['fileId' => $fileId, 'newFileId' => $newFileId, 'exception' => $e]);
		}
	}

	private function failure(\Exception $e, File $source): MoveResult {
		return match (true) {
			$e instanceof NotPermittedException => MoveResult::NotPermitted,
			$e instanceof LockedException => MoveResult::Locked,
			$e instanceof NotFoundException => MoveResult::NotFound,
			$e instanceof AlreadyExistsException => MoveResult::Exists,
			default => $this->failed($e, $source),
		};
	}

	private function failed(\Exception $e, File $source): MoveResult {
		$this->logger->warning('A file could not be moved', ['fileId' => $source->getId(), 'exception' => $e]);
		return MoveResult::Failed;
	}

	/** @return array{result: MoveResult, replaced: bool, path: string, newFileId: int, etag: string} */
	private static function moved(CheckedMove $move, Node $node, bool $replaced): array {
		return ['result' => MoveResult::Moved, 'replaced' => $replaced, 'path' => $move->path, 'newFileId' => $node->getId(), 'etag' => $node->getEtag()];
	}

	/** The move to make, or why the file may not move. */
	private function check(string $userId, Folder $userFolder, MoveFile $file): CheckedMove|MoveResult {
		$source = $this->photos->listed($userFolder, $file->fileId);
		if ($source === null) {
			return MoveResult::NotFound;
		}
		if ($source->getEtag() !== $file->etag) {
			return MoveResult::Changed;
		}
		if (!$source->isDeletable()) {
			return MoveResult::NotPermitted;
		}
		try {
			$target = $this->existing($userFolder, $file->path);
			$parent = $this->deepestFolder($userFolder, dirname($file->path));
		} catch (NotPermittedException) {
			return MoveResult::NotPermitted;
		}
		if ($target !== null && $target->getId() === $source->getId()) {
			return new CheckedMove($source, $file->path, null, true);
		}
		if ($parent === null) {
			return MoveResult::Exists;
		}
		$storage = StorageRoot::of($userFolder, $source);
		if (StorageRoot::of($userFolder, $parent) !== $storage || ($target !== null && StorageRoot::of($userFolder, $target) !== $storage)) {
			return MoveResult::OtherStorage;
		}
		if (!$parent->isCreatable()) {
			return MoveResult::NotPermitted;
		}
		if ($target === null) {
			return new CheckedMove($source, $file->path, null, false);
		}
		$replaceable = $target instanceof File && $target->getId() === $file->replaceFileId && $target->getEtag() === $file->replaceEtag;
		if (!$replaceable) {
			return MoveResult::Exists;
		}
		if (!$target->isDeletable()) {
			return MoveResult::NotPermitted;
		}
		$refusal = $this->trashBin->refusal($userId, $target);
		if ($refusal === null || $file->replacePermanent) {
			return new CheckedMove($source, $file->path, $target, false, $refusal !== null);
		}
		return $refusal === TrashResult::TooLarge ? MoveResult::TooLarge : MoveResult::NoTrashBin;
	}

	/** @throws NotPermittedException */
	private function existing(Folder $userFolder, string $path): ?Node {
		try {
			return $userFolder->get(ltrim($path, '/'));
		} catch (NotFoundException) {
			return null;
		}
	}

	/**
	 * The deepest existing folder on the path, or null when a file is in the way.
	 * @throws NotPermittedException
	 */
	private function deepestFolder(Folder $userFolder, string $path): ?Folder {
		$folder = $userFolder;
		foreach (self::segments($path) as $name) {
			try {
				$node = $folder->get($name);
			} catch (NotFoundException) {
				return $folder;
			}
			if (!$node instanceof Folder) {
				return null;
			}
			$folder = $node;
		}
		return $folder;
	}

	/** @return list<string> the folder names of an absolute path */
	private static function segments(string $path): array {
		return array_values(array_filter(explode('/', $path), static fn (string $name): bool => $name !== ''));
	}
}
