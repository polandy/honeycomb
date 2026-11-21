<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

/**
 * A page under a decision filter no undecided picture passes: the decision table's rows, read back from Immich (IMMICH-002.22, ADR 0044).
 * @psalm-import-type Entry from AssetEntries
 */
final class DecidedPages {
	/** Between the capture time and the asset id of the key in the cursor. */
	private const string KEY_SEPARATOR = ':';

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through DI. */
	public function __construct(
		private ImmichClient $client,
		private ImmichSearchFilter $filter,
		private ListingCursors $cursors,
		private AssetEntries $entries,
		private ImmichDecisionStore $store,
	) {
	}

	/**
	 * The rows after the cursor's key; a row whose asset Immich reports as deleted is deleted; a trashed or archived asset keeps its row (IMMICH-003.12).
	 * @param ?string $key the opened cursor's key, null on the first page
	 * @return array{entries: list<Entry>, nextCursor: ?string, previousCursor: null}
	 */
	public function page(Connection $connection, ListingFilters $filters, ?string $key, int $receivedBefore, int $size): array {
		$rows = $this->store->page($connection->user, $connection->id, $filters, $key === null ? null : $this->after($key), $size + 1);
		$more = count($rows) > $size;
		$rows = array_slice($rows, 0, $size);
		if ($rows === []) {
			return ['entries' => [], 'nextCursor' => null, 'previousCursor' => null];
		}
		$decisions = [];
		foreach ($rows as $row) {
			$decisions[$row->assetId] = $row;
		}
		$assetIds = array_keys($decisions);
		$answered = $this->client->search($connection, ['filter' => $this->filter->byIds($assetIds), 'size' => count($assetIds), 'withExif' => true, 'withStacked' => true])['items'];
		// Only the asked assets, so an answer beyond the filter cannot add entries without a row.
		$items = array_values(array_filter($answered, static function (mixed $item) use ($decisions): bool {
			/** @var mixed $id */
			$id = is_array($item) ? ($item['id'] ?? null) : null;
			return is_string($id) && isset($decisions[$id]);
		}));
		$entries = $this->entries->of($items, $decisions);
		$found = array_map(static fn (array $item): mixed => $item['id'], $items);
		$this->removeDeleted($connection, array_values(array_diff($assetIds, $found)));
		$order = array_flip($assetIds);
		usort($entries, static fn (array $a, array $b): int => $order[$a['assetId']] <=> $order[$b['assetId']]);
		$last = $rows[count($rows) - 1];
		$next = $more ? $this->cursors->issue($connection->id, $filters, $last->takenAt . self::KEY_SEPARATOR . $last->assetId, $receivedBefore) : null;
		return ['entries' => $entries, 'nextCursor' => $next, 'previousCursor' => null];
	}

	/**
	 * Deletes the rows of the assets Immich no longer holds at all.
	 * @param list<string> $missing assets the upload library's visible set did not return
	 */
	private function removeDeleted(Connection $connection, array $missing): void {
		if ($missing === []) {
			return;
		}
		$held = $this->client->search($connection, ['filter' => $this->filter->heldByIds($missing), 'size' => count($missing)])['items'];
		$heldIds = array_map(static fn (mixed $item): mixed => is_array($item) ? ($item['id'] ?? null) : null, $held);
		$deleted = array_values(array_diff($missing, $heldIds));
		if ($deleted !== []) {
			$this->store->remove($connection->user, $connection->id, $deleted);
		}
	}

	/** @return array{takenAt: int, assetId: string} */
	private function after(string $key): array {
		$parts = explode(self::KEY_SEPARATOR, $key);
		if (count($parts) !== 2 || !ctype_digit($parts[0]) || preg_match(AssetDecision::ASSET_ID, $parts[1]) !== 1) {
			throw new ImmichException(ImmichError::Request);
		}
		return ['takenAt' => (int)$parts[0], 'assetId' => $parts[1]];
	}
}
