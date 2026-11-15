<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\IUser;

/** The legacy decision and tag rows a user still has, their export and their removal (ADR 0032). */
final class LegacyService {
	public function __construct(
		private DecisionStore $decisions,
		private TagStore $tags,
		private UserPhotos $photos,
	) {
	}

	/**
	 * The folders holding a photo with a legacy row, sorted by path, and how many file ids the user no longer reaches.
	 * @return array{folders: list<array{path: string, files: int}>, unreachable: int}
	 */
	public function folders(IUser $user): array {
		$userFolder = $this->photos->userFolder($user);
		$files = [];
		$unreachable = 0;
		foreach ($this->fileIds($user) as $fileId) {
			$photo = $this->photos->photo($userFolder, $fileId);
			if ($photo === null) {
				$unreachable++;
				continue;
			}
			$folder = dirname((string)$userFolder->getRelativePath($photo->getPath()));
			$files[$folder] = ($files[$folder] ?? 0) + 1;
		}
		ksort($files, SORT_STRING);
		$folders = [];
		foreach ($files as $path => $count) {
			$folders[] = ['path' => $path, 'files' => $count];
		}
		return ['folders' => $folders, 'unreachable' => $unreachable];
	}

	/**
	 * The legacy rows of the file ids the user no longer reaches as a photo.
	 * @return array{decisions: list<PictureDecision>, tags: list<PictureTags>}
	 */
	public function export(IUser $user): array {
		$userFolder = $this->photos->userFolder($user);
		$unreachable = array_values(array_filter($this->fileIds($user), fn (int $fileId): bool => $this->photos->photo($userFolder, $fileId) === null));
		return [
			'decisions' => $this->decisions->find($user->getUID(), $unreachable),
			'tags' => $this->tags->find($user->getUID(), $unreachable),
		];
	}

	/**
	 * Removes the user's decision and tag rows of `$fileIds`; the tag list stays.
	 * @param array<array-key, mixed> $fileIds
	 * @throws InvalidLegacyRequestException for a malformed list
	 */
	public function acknowledge(IUser $user, array $fileIds): void {
		$parsed = FileIds::parse($fileIds, ListingService::ENTRY_LIMIT, InvalidLegacyRequestException::class);
		$this->decisions->forget($user->getUID(), $parsed);
		$this->tags->forget($user->getUID(), $parsed);
	}

	/** @return list<int> the file ids with a decision or tag row, sorted, each once */
	private function fileIds(IUser $user): array {
		$fileIds = array_values(array_unique([...$this->decisions->fileIdsOf($user->getUID()), ...$this->tags->fileIdsOf($user->getUID())]));
		sort($fileIds);
		return $fileIds;
	}
}
