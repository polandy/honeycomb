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
	) {
	}

	/**
	 * The user's stored decisions among `$fileIds`; a file id without one is undecided.
	 * @param array<array-key, mixed> $fileIds
	 * @return list<PictureDecision>
	 * @throws InvalidDecisionException for anything but a list of positive file ids within the limit
	 */
	public function lookup(IUser $user, array $fileIds): array {
		$this->checkSize($fileIds);
		foreach ($fileIds as $fileId) {
			if (!is_int($fileId) || $fileId < 1) {
				throw new InvalidDecisionException('fileIds must be positive integers');
			}
		}
		/** @var list<int> $fileIds */
		return $this->store->find($user->getUID(), $fileIds);
	}

	/**
	 * Replaces the user's decisions with the whole states in `$items`, all or nothing.
	 * @param array<array-key, mixed> $items
	 * @throws InvalidDecisionException for a malformed item or a file id given twice
	 */
	public function save(IUser $user, array $items): void {
		$this->checkSize($items);
		$decisions = array_map(PictureDecision::fromRequest(...), $items);
		$fileIds = array_map(static fn (PictureDecision $decision): int => $decision->fileId, $decisions);
		if (count(array_unique($fileIds)) !== count($fileIds)) {
			throw new InvalidDecisionException('Each file id may appear only once');
		}
		$stored = array_values(array_filter($decisions, static fn (PictureDecision $decision): bool => !$decision->isDefault()));
		$this->store->replace($user->getUID(), $fileIds, $stored);
	}

	/**
	 * @param array<array-key, mixed> $list
	 * @psalm-assert list<mixed> $list
	 */
	private function checkSize(array $list): void {
		if (!array_is_list($list) || count($list) > ListingService::ENTRY_LIMIT) {
			throw new InvalidDecisionException('Expected a list of at most ' . ListingService::ENTRY_LIMIT . ' items');
		}
	}
}
