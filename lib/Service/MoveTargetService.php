<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

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
	 * Every child of each folder, in the order sent; a missing, unreadable or non-folder path has none.
	 * @param array<array-key, mixed> $folders
	 * @return list<array{path: string, children: list<array{name: string, fileId: int, etag: string}>}>
	 * @throws InvalidMoveRequestException
	 */
	public function targets(IUser $user, array $folders): array {
		$userFolder = $this->rootFolder->getUserFolder($user->getUID());
		return array_map(fn (string $path): array => ['path' => $path, 'children' => $this->children($userFolder, $path)], MoveRequest::folders($folders));
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
