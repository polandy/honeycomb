<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Listing;

use OCA\Honeycomb\Domain\Limits;
use OCA\Honeycomb\Domain\PhotoFiles;
use OCA\Honeycomb\Service\Files\FolderNotFoundException;
use OCA\Honeycomb\Service\Files\FolderNotReadableException;
use OCA\Honeycomb\Service\Files\UserFolderResolver;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\Node;
use OCP\Files\NotPermittedException;
use OCP\IUser;

/** Lists the files of one picked folder from the file cache: members and sidecars, unpaired. */
final class ListingService {
	public const METADATA_BATCH = 1_000;

	public function __construct(
		private UserFolderResolver $folders,
		private EntryFactory $entryFactory,
		private RawHeaderBackfill $backfill,
		private int $entryLimit = Limits::ENTRIES,
	) {
	}

	/**
	 * Entries of the folder at `$path` in the user's files, with `$subfolders` of every folder below
	 * except hidden and `$excluded` ones, at most the entry limit.
	 * @param list<string> $excluded user-relative folder paths
	 * @throws FolderNotFoundException for a foreign, vanished or non-folder path
	 * @throws FolderNotReadableException when the user may not read the folder
	 */
	public function list(IUser $user, string $path, bool $subfolders, array $excluded = []): Listing {
		$folder = $this->folders->folder($user, $path);
		$userFolder = $this->folders->userFolder($user);
		try {
			return $this->collect($user, $userFolder, $folder, $subfolders ? $this->walkBelow($userFolder, $folder, array_flip($excluded)) : $folder->getDirectoryListing());
		} catch (NotPermittedException) {
			throw new FolderNotReadableException($path);
		}
	}

	/** @param iterable<Node> $nodes */
	private function collect(IUser $user, Folder $userFolder, Folder $folder, iterable $nodes): Listing {
		$entries = [];
		$batch = [];
		/** @var array<string, array{path: string, permissions: int}> $folders */
		$folders = [];
		foreach ($nodes as $node) {
			if (!$this->isListed($folder, $node)) {
				continue;
			}
			if (count($entries) + count($batch) === $this->entryLimit) {
				return new Listing([...$entries, ...$this->entries($user, $userFolder, $batch)], true, array_values($folders), $folder->getId());
			}
			$batch[] = $node;
			$folders[dirname($node->getPath())] ??= $this->folderOf($userFolder, $node);
			if (count($batch) === self::METADATA_BATCH) {
				array_push($entries, ...$this->entries($user, $userFolder, $batch));
				$batch = [];
			}
		}
		return new Listing([...$entries, ...$this->entries($user, $userFolder, $batch)], false, array_values($folders), $folder->getId());
	}

	/**
	 * The entries of `$files`, queueing the header read of their RAW files without the key (LISTING-004.14).
	 * @param list<File> $files
	 * @return list<Entry>
	 */
	private function entries(IUser $user, Folder $userFolder, array $files): array {
		$this->backfill->queueFiles($user, $files);
		return $this->entryFactory->create($userFolder, $files);
	}

	/**
	 * The folder of the node by its path and the user's permissions on it (LISTING-001.19).
	 * @return array{path: string, permissions: int}
	 */
	private function folderOf(Folder $userFolder, File $node): array {
		$path = $userFolder->getRelativePath(dirname($node->getPath())) ?? '/';
		return ['path' => $path, 'permissions' => $node->getParent()->getPermissions()];
	}

	/** @psalm-assert-if-true File $node */
	private function isListed(Folder $folder, Node $node): bool {
		if (!$node instanceof File) {
			return false;
		}
		$relative = $folder->getRelativePath($node->getPath());
		if ($relative === null || preg_match('#/\.#', $relative) === 1) {
			return false;
		}
		return PhotoFiles::isListedType($node);
	}

	/**
	 * The files of `$folder` and of every folder below it, depth first, one listing per folder;
	 * hidden, excluded folders and those the user may not read are never opened.
	 * @param array<string, int> $excluded user-relative folder paths as keys
	 * @return \Generator<Node>
	 */
	private function walkBelow(Folder $userFolder, Folder $folder, array $excluded): \Generator {
		$pending = [$folder];
		while (($current = array_pop($pending)) !== null) {
			$subfolders = [];
			foreach ($current->getDirectoryListing() as $node) {
				if (!$node instanceof Folder) {
					yield $node;
				} elseif (!str_starts_with($node->getName(), '.') && $node->isReadable() && !isset($excluded[(string)$userFolder->getRelativePath($node->getPath())])) {
					$subfolders[] = $node;
				}
			}
			array_push($pending, ...array_reverse($subfolders));
		}
	}
}
