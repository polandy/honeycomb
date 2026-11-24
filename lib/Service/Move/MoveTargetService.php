<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Move;

use OCA\Honeycomb\Domain\InvalidRequestException;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\IUser;

/** Lists what the target folders of a move already hold, so the client can find conflicts (ADR 0018). */
final class MoveTargetService {
	public function __construct(
		private IRootFolder $rootFolder,
	) {
	}

	/**
	 * Every child of each folder and the storage of each folder and source folder, in the order sent; a missing, unreadable or non-folder path has no children.
	 * @param array<array-key, mixed> $folders
	 * @param array<array-key, mixed> $sources
	 * @return array{folders: list<array{path: string, storage: string, children: list<array{name: string, fileId: int, etag: string}>}>, sources: list<array{path: string, storage: string}>}
	 * @throws InvalidRequestException
	 */
	public function targets(IUser $user, array $folders, array $sources = []): array {
		$folders = MoveRequest::folders($folders);
		$sources = MoveRequest::folders($sources);
		$userFolder = $this->rootFolder->getUserFolder($user->getUID());
		return [
			'folders' => array_map(fn (string $path): array => ['path' => $path, 'storage' => $this->storage($userFolder, $path), 'children' => $this->children($userFolder, $path)], $folders),
			'sources' => array_map(fn (string $path): array => ['path' => $path, 'storage' => $this->storage($userFolder, $path)], $sources),
		];
	}

	/** The storage of the deepest folder on the path that exists and may be read, where a move into it would land. */
	private function storage(Folder $userFolder, string $path): string {
		$folder = $userFolder;
		foreach (array_filter(explode('/', $path), static fn (string $name): bool => $name !== '') as $name) {
			try {
				$node = $folder->get($name);
			} catch (NotFoundException|NotPermittedException) {
				break;
			}
			if (!$node instanceof Folder) {
				break;
			}
			$folder = $node;
		}
		return StorageRoot::of($userFolder, $folder);
	}

	/** @return list<array{name: string, fileId: int, etag: string}> */
	private function children(Folder $userFolder, string $path): array {
		try {
			$folder = $path === '/' ? $userFolder : $userFolder->get(ltrim($path, '/'));
		} catch (NotFoundException|NotPermittedException) {
			return [];
		}
		if (!$folder instanceof Folder || !$folder->isReadable()) {
			return [];
		}
		return array_values(array_map(static fn (Node $node): array => ['name' => $node->getName(), 'fileId' => $node->getId(), 'etag' => $node->getEtag()], $folder->getDirectoryListing()));
	}
}
