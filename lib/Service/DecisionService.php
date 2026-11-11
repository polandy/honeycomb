<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\DB\Exception as DbException;
use OCP\IUser;

/** Reads and writes each user's decisions per file id (ADR 0012). */
final class DecisionService {
	/** A save tries this often; each repeat follows a concurrent save of the same file committing first. */
	private const int SAVE_ATTEMPTS = 3;

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
		$this->replaceWithRetry($user->getUID(), $fileIds, $stored);
	}

	/**
	 * Two saves of one file at once both pass the delete and the second insert hits the unique key;
	 * the winner has committed by then, so the same save now replaces its row (last writer wins).
	 * @param list<int> $fileIds
	 * @param list<PictureDecision> $stored
	 * @throws DbException for any other database error, or a conflict on every attempt
	 */
	private function replaceWithRetry(string $userId, array $fileIds, array $stored): void {
		for ($attempt = 1;; ++$attempt) {
			try {
				$this->store->replace($userId, $fileIds, $stored);
				return;
			} catch (DbException $e) {
				if ($e->getReason() !== DbException::REASON_UNIQUE_CONSTRAINT_VIOLATION || $attempt >= self::SAVE_ATTEMPTS) {
					throw $e;
				}
			}
		}
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
