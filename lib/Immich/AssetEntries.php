<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCA\Honeycomb\Service\Flag;

/**
 * Maps Immich's assets to listing entries; an asset of another shape is the version state (IMMICH-002.4, IMMICH-001.16).
 * @psalm-type Entry = array{assetId: string, name: string, takenAt: int, cameraModel: ?string, kind: string, width: ?int, height: ?int, duration: ?float, stackSize: ?int, updatedAt: string, rating: int, colourLabel: ?string, flag: string, keepRaw: bool}
 */
final class AssetEntries {
	private const string DATE = '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/';
	private const float MILLISECONDS = 1000.0;

	/**
	 * One entry per picture with its decision, undecided without one: a stack shows as its primary asset only.
	 * @param list<mixed> $assets
	 * @param array<string, AssetDecision> $decisions by asset id
	 * @return list<Entry>
	 */
	public function of(array $assets, array $decisions = []): array {
		$entries = [];
		foreach ($assets as $asset) {
			if (!is_array($asset)) {
				throw new ImmichException(ImmichError::Version);
			}
			/** @var mixed $stack */
			$stack = $asset['stack'] ?? null;
			if ($stack !== null && (!is_array($stack) || ($stack['primaryAssetId'] ?? null) !== ($asset['id'] ?? null))) {
				continue;
			}
			$entry = $this->entry($asset, $stack);
			$decision = $decisions[$entry['assetId']] ?? null;
			if ($decision !== null) {
				$entry['rating'] = $decision->rating;
				$entry['colourLabel'] = $decision->colourLabel?->value;
				$entry['flag'] = $decision->flag->value;
				$entry['keepRaw'] = $decision->keepRaw;
			}
			$entries[] = $entry;
		}
		return $entries;
	}

	/**
	 * @param array<array-key, mixed> $asset
	 * @param ?array<array-key, mixed> $stack
	 * @return Entry
	 */
	private function entry(array $asset, ?array $stack): array {
		/** @var mixed $exif */
		$exif = $asset['exifInfo'] ?? null;
		/** @var mixed $model */
		$model = is_array($exif) ? ($exif['model'] ?? null) : null;
		/** @var mixed $duration */
		$duration = $asset['duration'] ?? null;
		/** @var mixed $stackSize */
		$stackSize = $stack === null ? null : ($stack['assetCount'] ?? null);
		$entry = [
			'assetId' => $asset['id'] ?? null,
			'name' => $asset['originalFileName'] ?? null,
			'takenAt' => $this->seconds($asset['fileCreatedAt'] ?? null),
			'cameraModel' => $model,
			'kind' => $this->kind($asset)->value,
			'width' => $asset['width'] ?? null,
			'height' => $asset['height'] ?? null,
			'duration' => is_int($duration) || is_float($duration) ? (float)$duration / self::MILLISECONDS : $duration,
			'stackSize' => $stackSize,
			'updatedAt' => $asset['updatedAt'] ?? null,
			'rating' => 0,
			'colourLabel' => null,
			'flag' => Flag::Unflagged->value,
			'keepRaw' => false,
		];
		if (!is_string($entry['assetId']) || !is_string($entry['name']) || !is_string($entry['updatedAt'])
			|| ($model !== null && !is_string($model)) || ($duration !== null && !is_float($entry['duration']))
			|| !$this->isCount($entry['width']) || !$this->isCount($entry['height']) || !$this->isCount($stackSize)) {
			throw new ImmichException(ImmichError::Version);
		}
		/** @var Entry $entry */
		return $entry;
	}

	private function kind(array $asset): AssetKind {
		return match ($asset['type'] ?? null) {
			'VIDEO' => AssetKind::Video,
			'IMAGE' => is_string($asset['livePhotoVideoId'] ?? null) ? AssetKind::Live : AssetKind::Photo,
			default => throw new ImmichException(ImmichError::Version),
		};
	}

	private function seconds(mixed $date): int {
		if (!is_string($date) || preg_match(self::DATE, $date) !== 1) {
			throw new ImmichException(ImmichError::Version);
		}
		return (new \DateTimeImmutable($date))->getTimestamp();
	}

	private function isCount(mixed $value): bool {
		return $value === null || (is_int($value) && $value >= 0);
	}
}
