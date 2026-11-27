<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCA\Honeycomb\Domain\Flag;

/**
 * Sends one block of the write plan's changes to Immich and stores what it wrote (IMMICH-004.19 to .21).
 * @psalm-type WriteResult = array{assetId: string, state: 'written'}|array{assetId: string, state: 'failed', error: string}
 */
final class ImmichWrite {
	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through DI. */
	public function __construct(
		private ImmichClient $client,
		private ImmichDecisionStore $store,
	) {
	}

	/**
	 * Trashes, restores and updates the assets, and answers each one's result in the asked order.
	 * @return array{results: list<WriteResult>}
	 */
	public function write(Connection $connection, mixed $assets): array {
		$changes = $this->changes($assets);
		$decisions = $this->store->find($connection->user, $connection->id, array_keys($changes));
		$progress = new WriteProgress();
		foreach ($changes as $id => $change) {
			$flag = ($decisions[$id] ?? null)?->flag;
			if ($flag === null) {
				$progress->fail($id, ImmichError::UnknownAsset);
			} elseif ($change->trash && $flag !== Flag::Rejected) {
				$progress->fail($id, ImmichError::Request);
			}
		}
		$this->inBulk($progress, $this->pending($changes, $progress, static fn (AssetChange $change): bool => $change->trash),
			fn (array $ids) => $this->client->trash($connection, $ids));
		$this->inBulk($progress, $this->pending($changes, $progress, static fn (AssetChange $change): bool => $change->restore),
			fn (array $ids) => $this->client->restore($connection, $ids));
		foreach ($this->pending($changes, $progress, static fn (AssetChange $change): bool => $change->fields !== []) as $id) {
			/** @var non-empty-array<string, bool|int|string|null> $fields the filter keeps only changes with fields */
			$fields = $changes[$id]->fields;
			$progress->call([$id], fn () => $this->client->update($connection, $id, $fields));
		}
		$written = [];
		$results = [];
		foreach ($changes as $id => $change) {
			$error = $progress->error($id);
			if ($error === null) {
				$written[$id] = new WrittenState($decisions[$id]->flag, $decisions[$id]->rating, $change->immichRating);
			}
			$results[] = $error === null ? ['assetId' => $id, 'state' => 'written'] : ['assetId' => $id, 'state' => 'failed', 'error' => $error->value];
		}
		$this->store->markWritten($connection->user, $connection->id, $written);
		return ['results' => $results];
	}

	/**
	 * The asked changes by asset id: a list of one to 100 changes of distinct assets, else a bad request.
	 * @return non-empty-array<string, AssetChange>
	 */
	private function changes(mixed $assets): array {
		if (!is_array($assets) || $assets === [] || !array_is_list($assets) || count($assets) > ImmichWriteCheck::BLOCK) {
			throw new ImmichException(ImmichError::Request);
		}
		$changes = [];
		/** @var mixed $raw */
		foreach ($assets as $raw) {
			$change = AssetChange::fromRequest($raw);
			if (isset($changes[$change->assetId])) {
				throw new ImmichException(ImmichError::Request);
			}
			$changes[$change->assetId] = $change;
		}
		return $changes;
	}

	/**
	 * The ids of the assets that want the call and have not failed, in the asked order.
	 * @param array<string, AssetChange> $changes
	 * @param callable(AssetChange): bool $wanted
	 * @return list<string>
	 */
	private function pending(array $changes, WriteProgress $progress, callable $wanted): array {
		return array_map(strval(...), array_keys(array_filter($changes,
			static fn (AssetChange $change): bool => $wanted($change) && !$progress->hasFailed($change->assetId))));
	}

	/**
	 * One bulk call for the assets; when Immich refuses an asset of it, the call is repeated per asset (IMMICH-004.10).
	 * @param list<string> $ids
	 * @param callable(non-empty-list<string>): void $call
	 */
	private function inBulk(WriteProgress $progress, array $ids, callable $call): void {
		if ($ids === [] || $progress->call($ids, static fn () => $call($ids))
			|| count($ids) === 1 || $progress->error($ids[0]) !== ImmichError::UnknownAsset) {
			return;
		}
		foreach ($ids as $id) {
			$progress->call([$id], static fn () => $call([$id]));
		}
	}
}
