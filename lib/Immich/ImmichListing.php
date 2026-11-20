<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCP\AppFramework\Utility\ITimeFactory;

/**
 * One page of a connection's uploads with their decisions, newest first, from Immich's paged search (IMMICH-002).
 * @psalm-import-type Entry from AssetEntries
 */
final class ImmichListing {
	public const int MAX_SIZE = 250;
	private const array ORDER = ['field' => 'fileCreatedAt', 'direction' => 'desc'];

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
	 * The page after the cursor, or the first page without one.
	 * @param array<array-key, mixed> $filters
	 * @return array{entries: list<Entry>, nextCursor: ?string, previousCursor: null}
	 */
	public function page(Connection $connection, array $filters, ?string $cursor, int $size): array {
		if ($size < 1 || $size > self::MAX_SIZE) {
			throw new ImmichException(ImmichError::Request);
		}
		$checked = new ListingFilters($filters);
		$opened = $cursor === null ? null : $this->cursors->open($cursor, $connection->id, $checked);
		$receivedBefore = $opened === null ? $this->time->getTime() : $opened['receivedBefore'];
		// Immich knows no decisions, so a filter no undecided picture passes pages the decision table instead (ADR 0044).
		if (!$checked->admitsUndecided()) {
			return $this->decided->page($connection, $checked, $opened['immich'] ?? null, $receivedBefore, $size);
		}
		$body = [
			'filter' => $this->filter->of($checked, $receivedBefore),
			'orderBy' => self::ORDER,
			'size' => $size,
			'withExif' => true,
			'withStacked' => true,
		];
		if ($opened !== null) {
			$body['cursor'] = $opened['immich'];
		}
		$page = $this->client->search($connection, $body);
		$next = $page['nextCursor'] === null ? null : $this->cursors->issue($connection->id, $checked, $page['nextCursor'], $receivedBefore);
		return ['entries' => $this->decide($connection, $checked, $page['items']), 'nextCursor' => $next, 'previousCursor' => null];
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
