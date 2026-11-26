<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

/** Builds the filter of Immich's v3 search for the listing filters (IMMICH-002, ADR 0044). */
final class ImmichSearchFilter {
	private const string DATE = 'Y-m-d\TH:i:s\Z';

	/**
	 * The upload library's visible photos and videos (IMMICH-002.3).
	 * @return array<string, array<string, mixed>>
	 */
	public function uploads(): array {
		return [
			'libraryId' => ['eq' => null],
			'visibility' => ['eq' => 'timeline'],
			'trashedAt' => ['eq' => null],
			'type' => ['in' => ['IMAGE', 'VIDEO']],
		];
	}

	/**
	 * The uploads among the assets; Immich's id filter knows no list, so each id is a branch.
	 * @param non-empty-list<string> $assetIds
	 * @return array<string, mixed>
	 */
	public function byIds(array $assetIds): array {
		return [...$this->uploads(), 'or' => array_map(static fn (string $assetId): array => ['id' => ['eq' => $assetId]], $assetIds)];
	}

	/**
	 * The assets Immich still holds, in its trash bin or archive too, whichever library.
	 * @param non-empty-list<string> $assetIds
	 * @return array<string, mixed>
	 */
	public function heldByIds(array $assetIds): array {
		return ['or' => array_map(static fn (string $assetId): array => ['id' => ['eq' => $assetId]], $assetIds)];
	}

	/**
	 * The uploads received up to the time that pass the filters: devices and kinds as the branches of one search.
	 * With an anchor, only those up to its second, or from it on when `newer` (IMMICH-002.34).
	 * @return array<string, mixed>
	 */
	public function of(ListingFilters $filters, int $receivedBefore, ?ListingAnchor $anchor = null, bool $newer = false): array {
		$filter = [...$this->uploads(), 'createdAt' => ['lte' => $this->date($receivedBefore)]];
		$after = $filters->takenAfter;
		$before = $filters->takenBefore;
		if ($anchor !== null && $newer) {
			$after = max($after ?? $anchor->takenAt, $anchor->takenAt);
		} elseif ($anchor !== null) {
			$before = min($before ?? $anchor->takenAt + 1, $anchor->takenAt + 1);
		}
		$taken = [];
		if ($after !== null) {
			$taken['gte'] = $this->date($after);
		}
		if ($before !== null) {
			$taken['lt'] = $this->date($before);
		}
		if ($taken !== []) {
			$filter['takenAt'] = $taken;
		}
		$branches = $this->branches($this->deviceAtoms($filters->devices), array_map($this->kindAtom(...), $filters->kinds));
		if ($branches !== []) {
			$filter['or'] = $branches;
		}
		return $filter;
	}

	/**
	 * Every device atom with every kind atom, device-major; one group alone is its own branches.
	 * @param list<array<string, mixed>> $devices
	 * @param list<array<string, mixed>> $kinds
	 * @return list<array<string, mixed>>
	 */
	private function branches(array $devices, array $kinds): array {
		if ($devices === [] || $kinds === []) {
			return [...$devices, ...$kinds];
		}
		$branches = [];
		foreach ($devices as $device) {
			foreach ($kinds as $kind) {
				$branches[] = [...$device, ...$kind];
			}
		}
		return $branches;
	}

	/**
	 * The named models in one atom and the pictures without a model in another.
	 * @param list<?string> $devices
	 * @return list<array<string, mixed>>
	 */
	private function deviceAtoms(array $devices): array {
		$models = array_values(array_filter($devices, static fn (?string $device): bool => $device !== null));
		$atoms = $models === [] ? [] : [['model' => ['in' => $models]]];
		if (in_array(null, $devices, true)) {
			$atoms[] = ['model' => ['eq' => null]];
		}
		return $atoms;
	}

	/** @return array<string, mixed> */
	private function kindAtom(AssetKind $kind): array {
		return match ($kind) {
			AssetKind::Photo => ['type' => ['eq' => 'IMAGE'], 'isMotion' => ['eq' => false]],
			AssetKind::Live => ['type' => ['eq' => 'IMAGE'], 'isMotion' => ['eq' => true]],
			AssetKind::Video => ['type' => ['eq' => 'VIDEO']],
		};
	}

	private function date(int $seconds): string {
		return (new \DateTimeImmutable("@$seconds"))->format(self::DATE);
	}
}
