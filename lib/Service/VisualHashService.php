<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\File;
use OCP\Files\Folder;
use OCP\IUser;

/** Stores the visual hashes the browser computed, each only for the current version of a photo the user reaches (ADR 0024). */
final class VisualHashService {
	/** The most hashes one save may carry. */
	public const int SAVE_LIMIT = 1_000;

	public function __construct(
		private VisualHashStore $store,
		private UserFolderResolver $userFolders,
	) {
	}

	/**
	 * Stores the hashes in `$items` whose file the user reaches as a photo at that etag; returns their file ids in request order.
	 * @param array<array-key, mixed> $items
	 * @return list<int>
	 * @throws InvalidVisualHashException for a malformed item, a file id given twice or too many items
	 */
	public function save(IUser $user, array $items): array {
		if (!array_is_list($items) || count($items) > self::SAVE_LIMIT) {
			throw new InvalidVisualHashException('Expected a list of at most ' . self::SAVE_LIMIT . ' items');
		}
		$hashes = array_map(VisualHash::fromRequest(...), $items);
		$fileIds = array_map(static fn (VisualHash $hash): int => $hash->fileId, $hashes);
		if (count(array_unique($fileIds)) !== count($fileIds)) {
			throw new InvalidVisualHashException('Each file id may appear only once');
		}
		$userFolder = $this->userFolders->userFolder($user);
		$current = array_values(array_filter($hashes, static fn (VisualHash $hash): bool => self::isCurrent($userFolder, $hash)));
		if ($current !== []) {
			RetryOnConflict::run(fn () => $this->store->replace($user->getUID(), $current));
		}
		return array_map(static fn (VisualHash $hash): int => $hash->fileId, $current);
	}

	/** Whether the hash's file is a photo in the user's folder and still at the hash's etag. */
	private static function isCurrent(Folder $userFolder, VisualHash $hash): bool {
		$node = $userFolder->getFirstNodeById($hash->fileId);
		return $node instanceof File && ListingService::isPhoto($node) && $node->getEtag() === $hash->etag;
	}
}
