<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCP\AppFramework\Utility\ITimeFactory;

/**
 * One page of a connection's uploads, newest first, from Immich's paged search (IMMICH-002).
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
		// Immich knows no decisions yet, so a filter an undecided picture fails matches nothing (ADR 0044).
		if (!$checked->admitsUndecided()) {
			return ['entries' => [], 'nextCursor' => null, 'previousCursor' => null];
		}
		$receivedBefore = $opened === null ? $this->time->getTime() : $opened['receivedBefore'];
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
		return ['entries' => $this->entries->of($page['items']), 'nextCursor' => $next, 'previousCursor' => null];
	}
}
