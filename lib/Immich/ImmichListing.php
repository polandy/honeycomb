<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCP\AppFramework\Utility\ITimeFactory;

/**
 * One page of a connection's uploads with their decisions, newest first, from Immich's paged search (IMMICH-002), or around an asset (IMMICH-002.34).
 * @psalm-import-type Entry from AssetEntries
 */
final class ImmichListing {
	public const int MAX_SIZE = 250;
	private const array ORDER = ['field' => 'fileCreatedAt', 'direction' => 'desc'];
	private const array NEWER_ORDER = ['field' => 'fileCreatedAt', 'direction' => 'asc'];

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through DI. */
	public function __construct(
		private ImmichClient $client,
		private ImmichSearchFilter $filter,
		private ListingCursors $cursors,
		private AssetEntries $entries,
		private ITimeFactory $time,
		private ImmichDecisionStore $decisions,
		private DecidedPages $decided,
	) {
	}

	/**
	 * The page after the cursor, or the first page without one; a first page from an asset starts at it and has a cursor to the newer entries (IMMICH-002.34).
	 * @param array<array-key, mixed> $filters
	 * @param ?array<array-key, mixed> $from `{assetId, takenAt}`, only without a cursor
	 * @return array{entries: list<Entry>, nextCursor: ?string, previousCursor: ?string}
	 */
	public function page(Connection $connection, array $filters, ?string $cursor, int $size, ?array $from = null): array {
		if ($size < 1 || $size > self::MAX_SIZE || ($from !== null && $cursor !== null)) {
			throw new ImmichException(ImmichError::Request);
		}
		$checked = new ListingFilters($filters);
		$opened = $cursor === null ? null : $this->cursors->open($cursor, $connection->id, $checked);
		$anchor = $from === null ? $opened['anchor'] ?? null : ListingAnchor::fromRequest($from);
		$newer = $opened['newer'] ?? false;
		$receivedBefore = $opened === null ? $this->time->getTime() : $opened['receivedBefore'];
		// Immich knows no decisions, so a filter no undecided picture passes pages the decision table instead (ADR 0044).
		if (!$checked->admitsUndecided()) {
			if ($anchor !== null) {
				throw new ImmichException(ImmichError::Request);
			}
			return $this->decided->page($connection, $checked, $opened['immich'] ?? null, $receivedBefore, $size);
		}
		$body = [
			'filter' => $this->filter->of($checked, $receivedBefore, $anchor, $newer),
			'orderBy' => $newer ? self::NEWER_ORDER : self::ORDER,
			'size' => $size,
			'withExif' => true,
			'withStacked' => true,
		];
		if (($opened['immich'] ?? null) !== null) {
			$body['cursor'] = $opened['immich'];
		}
		$page = $this->client->search($connection, $body);
		$entries = $this->decide($connection, $checked, $page['items']);
		$next = $page['nextCursor'] === null ? null : $this->cursors->issue($connection->id, $checked, $page['nextCursor'], $receivedBefore, $anchor, $newer);
		if ($anchor === null) {
			return ['entries' => $entries, 'nextCursor' => $next, 'previousCursor' => null];
		}
		$entries = array_values(array_filter($entries, static fn (array $entry): bool => self::beyond($entry, $anchor, $newer)));
		if ($newer) {
			return ['entries' => array_reverse($entries), 'nextCursor' => null, 'previousCursor' => $next];
		}
		$previous = $from === null ? null : $this->cursors->issue($connection->id, $checked, null, $receivedBefore, $anchor, true);
		return ['entries' => $entries, 'nextCursor' => $next, 'previousCursor' => $previous];
	}

	/**
	 * Whether the entry lies on the asked side of the anchor; uploads of the anchor's second split at it by asset id, the anchor older.
	 * @param Entry $entry
	 */
	private static function beyond(array $entry, ListingAnchor $anchor, bool $newer): bool {
		if ($entry['takenAt'] !== $anchor->takenAt) {
			return true;
		}
		return $newer ? $entry['assetId'] > $anchor->assetId : $entry['assetId'] <= $anchor->assetId;
	}

	/**
	 * The entries with their decisions, without the decided ones the filters refuse (IMMICH-002.23).
	 * @param list<mixed> $items
	 * @return list<Entry>
	 */
	private function decide(Connection $connection, ListingFilters $filters, array $items): array {
		/** @var list<string> $assetIds */
		$assetIds = array_values(array_filter(array_map(static fn (mixed $item): mixed => is_array($item) ? ($item['id'] ?? null) : null, $items), is_string(...)));
		$decisions = $assetIds === [] ? [] : $this->decisions->find($connection->user, $connection->id, $assetIds);
		$entries = $this->entries->of($items, $decisions);
		return array_values(array_filter($entries, static function (array $entry) use ($decisions, $filters): bool {
			$decision = $decisions[$entry['assetId']] ?? null;
			return $decision === null || $filters->admits($decision->flag, $decision->rating, $decision->colourLabel);
		}));
	}
}
