<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\Preview\UntypedRaw;
use OCA\Honeycomb\Search\BinaryOperator;
use OCA\Honeycomb\Search\Comparison;
use OCA\Honeycomb\Search\FileSearchQuery;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\Node;
use OCP\Files\NotPermittedException;
use OCP\Files\Search\ISearchBinaryOperator;
use OCP\Files\Search\ISearchComparison;
use OCP\IUser;

/** Lists the files of one picked folder from the file cache: members and sidecars, unpaired. */
final class ListingService {
	/** 20,000 pictures of a RAW, a JPEG and a sidecar each (`docs/plan.md` Multiple folders). */
	public const ENTRY_LIMIT = 60_000;
	public const PAGE_SIZE = 5_000;
	public const METADATA_BATCH = 1_000;

	public function __construct(
		private UserFolderResolver $folders,
		private EntryFactory $entryFactory,
		private SharedFolders $sharedFolders,
		private int $entryLimit = self::ENTRY_LIMIT,
		private int $pageSize = self::PAGE_SIZE,
	) {
	}

	/**
	 * Entries of the folder at `$path` in the user's files, with `$subfolders` of every folder below
	 * except hidden ones, at most the entry limit.
	 * @throws FolderNotFoundException for a foreign, vanished or non-folder path
	 * @throws FolderNotReadableException when the user may not read the folder
	 */
	public function list(IUser $user, string $path, bool $subfolders): Listing {
		$folder = $this->folders->folder($user, $path);
		$userFolder = $this->folders->userFolder($user);
		try {
			return $this->collect($user, $userFolder, $folder, $subfolders ? $this->searchBelow($user, $folder) : $folder->getDirectoryListing());
		} catch (NotPermittedException) {
			throw new FolderNotReadableException($path);
		}
	}

	/** @param iterable<Node> $nodes */
	private function collect(IUser $user, Folder $userFolder, Folder $folder, iterable $nodes): Listing {
		$entries = [];
		$batch = [];
		$folders = [];
		foreach ($nodes as $node) {
			if (!$this->isListed($folder, $node)) {
				continue;
			}
			if (count($entries) + count($batch) === $this->entryLimit) {
				return new Listing([...$entries, ...$this->entryFactory->create($userFolder, $batch)], true, array_values($folders));
			}
			$batch[] = $node;
			$folders[dirname($node->getPath())] ??= $this->folderOf($user, $userFolder, $node);
			if (count($batch) === self::METADATA_BATCH) {
				array_push($entries, ...$this->entryFactory->create($userFolder, $batch));
				$batch = [];
			}
		}
		return new Listing([...$entries, ...$this->entryFactory->create($userFolder, $batch)], false, array_values($folders));
	}

	/** @return array{path: string, shared: bool} */
	private function folderOf(IUser $user, Folder $userFolder, File $node): array {
		$path = $userFolder->getRelativePath(dirname($node->getPath())) ?? '/';
		return ['path' => $path, 'shared' => $this->sharedFolders->isShared($user, $node->getParent())];
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
		return self::isListedType($node);
	}

	/** Whether the listing lists a file of this type: a photo or an XMP sidecar. */
	public static function isListedType(File $file): bool {
		return self::isPhoto($file) || self::isSidecar($file);
	}

	/** Whether the file is an image, including RAW files Nextcloud does not type. */
	public static function isPhoto(File $file): bool {
		return str_starts_with($file->getMimetype(), 'image/') || UntypedRaw::isNamed($file->getName());
	}

	public static function isSidecar(File $file): bool {
		return str_ends_with(strtolower($file->getName()), '.xmp');
	}

	/** @return \Generator<Node> */
	private function searchBelow(IUser $user, Folder $folder): \Generator {
		$picturesAndSidecars = new BinaryOperator(ISearchBinaryOperator::OPERATOR_OR, [
			new Comparison(ISearchComparison::COMPARE_LIKE, 'mimetype', 'image/%'),
			new Comparison(ISearchComparison::COMPARE_LIKE, 'name', '%.xmp'),
			...array_map(static fn (string $extension): Comparison => new Comparison(ISearchComparison::COMPARE_LIKE, 'name', "%.$extension"), UntypedRaw::EXTENSIONS),
		]);
		$offset = 0;
		do {
			// Offset, not `fileid > cursor`: Nextcloud's file cache search allows only `eq` and `in` on fileid.
			$page = $folder->search(new FileSearchQuery($picturesAndSidecars, $this->pageSize, $offset, $user));
			yield from $page;
			$offset += count($page);
		} while (count($page) === $this->pageSize);
	}
}
