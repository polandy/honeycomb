<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\IUser;

/** Reads and writes each user's decisions per file id (ADR 0012). */
final class DecisionService {
	public function __construct(
		private DecisionStore $store,
		private UserPhotos $photos,
	) {
	}

	/**
	 * The user's stored decisions among `$fileIds`; a file id without one is undecided.
	 * @param array<array-key, mixed> $fileIds
	 * @return list<PictureDecision>
	 * @throws InvalidDecisionException for anything but a list of positive file ids within the limit
	 */
	public function lookup(IUser $user, array $fileIds): array {
		$fileIds = FileIds::parse($fileIds, ListingService::ENTRY_LIMIT, InvalidDecisionException::class);
		return $this->store->find($user->getUID(), $fileIds);
	}

	/**
	 * Replaces the user's decisions with the whole states in `$items`, all or nothing, skipping file ids that are not the user's photos.
	 * @param array<array-key, mixed> $items
	 * @throws InvalidDecisionException for a malformed item or a file id given twice
	 */
	public function save(IUser $user, array $items): void {
		$decisions = array_map(PictureDecision::fromRequest(...), FileIds::items($items, ListingService::ENTRY_LIMIT, InvalidDecisionException::class));
		$fileIds = $this->photos->photos($user, FileIds::eachOnce(array_map(static fn (PictureDecision $decision): int => $decision->fileId, $decisions), InvalidDecisionException::class));
		if ($fileIds === []) {
			return;
		}
		$isPhoto = array_flip($fileIds);
		$stored = array_values(array_filter($decisions, static fn (PictureDecision $decision): bool => isset($isPhoto[$decision->fileId]) && !$decision->isDefault()));
		RetryOnConflict::run(fn () => $this->store->replace($user->getUID(), $fileIds, $stored));
	}
}
