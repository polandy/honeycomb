<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCA\Honeycomb\Service\Limits;
use OCP\AppFramework\Utility\ITimeFactory;

/** Saves the user's decisions on a connection's assets; Immich is not asked (IMMICH-003). */
final class ImmichDecisions {
	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through DI. */
	public function __construct(
		private ImmichDecisionStore $store,
		private ITimeFactory $time,
	) {
	}

	/**
	 * Saves the whole decision of each asset; an asset named twice keeps its last one (IMMICH-003.17).
	 * @return array{saved: list<string>}
	 */
	public function save(Connection $connection, mixed $decisions): array {
		if (!is_array($decisions) || !array_is_list($decisions) || count($decisions) > Limits::ENTRIES) {
			throw new ImmichException(ImmichError::Request);
		}
		$byAsset = [];
		/** @var mixed $raw */
		foreach ($decisions as $raw) {
			$decision = AssetDecision::fromRequest($raw);
			$byAsset[$decision->assetId] = $decision;
		}
		$this->store->save($connection->user, $connection->id, array_values($byAsset), $this->time->getTime());
		return ['saved' => array_map(strval(...), array_keys($byAsset))];
	}
}
