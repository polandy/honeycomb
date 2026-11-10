<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\App\IAppManager;
use OCP\Files\AlreadyExistsException;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\IUser;
use OCP\Lock\LockedException;
use Psr\Log\LoggerInterface;

/**
 * Moves whole pictures to the paths the client rendered: each checked whole, moved file by file
 * and moved back when one of its files fails (ADR 0018).
 *
 * @psalm-type Outcome = array{fileId: int, result: MoveResult, replaced: bool, path?: string, newFileId?: int, etag?: string}
 */
final class MoveService {
	public function __construct(
		private IRootFolder $rootFolder,
		private IAppManager $appManager,
		private LoggerInterface $logger,
	) {
	}

	/**
	 * Moves the files of each picture and reports each file, pictures and files in the order sent.
	 * @param array<array-key, mixed> $pictures
	 * @return list<list<Outcome>>
	 * @throws InvalidMoveRequestException for a malformed request; nothing is touched
	 * @throws TrashBinDisabledException when a replace would not be restorable; nothing is touched
	 */
	public function move(IUser $user, array $pictures): array {
		$pictures = MoveRequest::pictures($pictures);
		$replaces = array_filter(array_merge(...$pictures), static fn (MoveFile $file): bool => $file->replaceFileId !== null);
		if ($replaces !== [] && !$this->appManager->isEnabledForUser('files_trashbin', $user)) {
			throw new TrashBinDisabledException('The trash bin is disabled for the user');
		}
		$userFolder = $this->rootFolder->getUserFolder($user->getUID());
		return array_map(fn (array $picture): array => $this->movePicture($userFolder, $picture), $pictures);
	}

	/**
	 * @param non-empty-list<MoveFile> $picture
	 * @return list<Outcome>
	 */
	private function movePicture(Folder $userFolder, array $picture): array {
		$checked = array_map(fn (MoveFile $file): CheckedMove|MoveResult => $this->check($userFolder, $file), $picture);
		$moves = array_filter($checked, static fn (CheckedMove|MoveResult $move): bool => $move instanceof CheckedMove);
		if (count($moves) !== count($checked)) {
			return array_map(static fn (MoveFile $file, CheckedMove|MoveResult $move): array => [
				'fileId' => $file->fileId,
				'result' => $move instanceof MoveResult ? $move : MoveResult::Skipped,
				'replaced' => false,
			], $picture, $checked);
		}
		$outcomes = $this->moveInOrder($userFolder, $moves);
		return array_map(static fn (MoveFile $file, array $outcome): array => ['fileId' => $file->fileId] + $outcome, $picture, $outcomes);
	}

	/**
	 * Moves the members, then the sidecars; at the first failure the moved files go back, last first.
	 * @param array<int, CheckedMove> $moves
	 * @return list<array{result: MoveResult, replaced: bool, path?: string, newFileId?: int, etag?: string}> in the order of `$moves`
	 */
	private function moveInOrder(Folder $userFolder, array $moves): array {
		$sidecars = array_filter($moves, static fn (CheckedMove $move): bool => ListingService::isSidecar($move->source));
		$outcomes = array_fill_keys(array_keys($moves), ['result' => MoveResult::Skipped, 'replaced' => false]);
		/** @var array<int, Node> $moved */
		$moved = [];
		foreach (array_diff_key($moves, $sidecars) + $sidecars as $index => $move) {
			$replaced = false;
			try {
				$moved[$index] = $this->moveFile($userFolder, $move, $replaced);
				$outcomes[$index] = self::moved($move, $moved[$index], $replaced);
			} catch (\Exception $e) {
				$outcomes[$index] = ['result' => $this->failure($e, $move->source), 'replaced' => $replaced];
				foreach (array_reverse($moved, true) as $back => $node) {
					$outcomes[$back] = $this->moveBack($node, $moves[$back]) ? ['result' => MoveResult::MovedBack, 'replaced' => $outcomes[$back]['replaced']] : $outcomes[$back];
				}
				break;
			}
		}
		return array_values($outcomes);
	}

	/**
	 * Creates the missing folders, trashes the file to replace and moves the file into its place.
	 * @param-out bool $replaced
	 */
	private function moveFile(Folder $userFolder, CheckedMove $move, bool &$replaced): Node {
		if ($move->stays) {
			return $move->source;
		}
		$folder = $userFolder;
		foreach (self::segments(dirname($move->path)) as $name) {
			$folder = $this->subfolder($folder, $name);
		}
		if ($move->replace !== null) {
			$move->replace->delete();
			$replaced = true;
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
			$node->move($move->from);
			return true;
		} catch (\Exception $e) {
			$this->logger->warning('A moved file could not be moved back', ['fileId' => $node->getId(), 'exception' => $e]);
			return false;
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
	private function check(Folder $userFolder, MoveFile $file): CheckedMove|MoveResult {
		$source = $userFolder->getFirstNodeById($file->fileId);
		if (!$source instanceof File || !ListingService::isListedType($source)) {
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
		return $target->isDeletable() ? new CheckedMove($source, $file->path, $target, false) : MoveResult::NotPermitted;
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
