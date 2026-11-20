<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

/** Immich's paged search and statistics over a list of assets: the v3 filter, newest `fileCreatedAt` first, ties by id, an offset cursor. */
final class FakeImmichLibrary {
	/** @var list<array<string, mixed>> */
	public array $assets = [];

	/**
	 * An asset as Immich answers it, taken and received at unix seconds, with fields overridden.
	 * @param array<string, mixed> $override
	 */
	public function add(string $id, int $takenAt, int $receivedAt = 0, array $override = []): void {
		$this->assets[] = [...[
			'id' => $id,
			'originalFileName' => "PXL_$id.jpg",
			'fileCreatedAt' => $this->date($takenAt),
			'localDateTime' => $this->date($takenAt),
			'createdAt' => $this->date($receivedAt),
			'updatedAt' => '2026-11-19T08:00:00.000Z',
			'ownerId' => 'f0e1d2c3-b4a5-4968-8776-655443322110',
			'type' => 'IMAGE',
			'livePhotoVideoId' => null,
			'duration' => null,
			'width' => 4080,
			'height' => 3072,
			'stack' => null,
			'exifInfo' => ['model' => 'Pixel 9 Pro'],
		], ...$override];
	}

	/**
	 * Answers a search request's options as Immich does.
	 * @param array<string, mixed> $options
	 * @return array{int, string, string}
	 */
	public function search(array $options): array {
		/** @var array{size?: int, cursor?: string, filter?: array<string, mixed>} $body */
		$body = json_decode((string)$options['body'], true, 512, JSON_THROW_ON_ERROR);
		$assets = $this->matching($body['filter'] ?? []);
		usort($assets, static fn (array $a, array $b): int => [$b['fileCreatedAt'], $b['id']] <=> [$a['fileCreatedAt'], $a['id']]);
		$size = $body['size'] ?? 250;
		/** @var array{offset: int} $cursor */
		$cursor = isset($body['cursor']) ? json_decode(base64_decode(strtr($body['cursor'], '-_', '+/')), true, 512, JSON_THROW_ON_ERROR) : ['offset' => 0];
		$page = array_slice($assets, $cursor['offset'], $size);
		$next = count($assets) > $cursor['offset'] + $size ? rtrim(strtr(base64_encode((string)json_encode(['offset' => $cursor['offset'] + $size])), '+/', '-_'), '=') : null;
		$answer = ['albums' => ['count' => 0, 'facets' => [], 'items' => [], 'total' => 0], 'assets' => ['count' => count($page), 'facets' => [], 'items' => $page, 'nextCursor' => $next, 'nextPage' => null, 'total' => count($page)]];
		return [200, json_encode($answer, JSON_THROW_ON_ERROR), 'application/json'];
	}

	/**
	 * Answers a statistics request's options as Immich does.
	 * @param array<string, mixed> $options
	 * @return array{int, string, string}
	 */
	public function statistics(array $options): array {
		/** @var array{filter?: array<string, mixed>} $body */
		$body = json_decode((string)$options['body'], true, 512, JSON_THROW_ON_ERROR);
		return [200, json_encode(['total' => count($this->matching($body['filter'] ?? []))], JSON_THROW_ON_ERROR), 'application/json'];
	}

	/**
	 * The assets the filter matches: its fields ANDed with any of its `or` branches.
	 * @param array<string, mixed> $filter
	 * @return list<array<string, mixed>>
	 */
	private function matching(array $filter): array {
		return array_values(array_filter($this->assets, fn (array $asset): bool => $this->matches($asset, $filter)));
	}

	/**
	 * @param array<string, mixed> $asset
	 * @param array<string, mixed> $filter
	 */
	private function matches(array $asset, array $filter): bool {
		foreach ($filter as $field => $condition) {
			/** @var array<string, mixed> $condition */
			if ($field === 'or') {
				/** @var list<array<string, mixed>> $condition */
				if (array_filter($condition, fn (array $branch): bool => $this->matches($asset, $branch)) === []) {
					return false;
				}
			} elseif (!$this->holds($this->field($asset, $field), $condition)) {
				return false;
			}
		}
		return true;
	}

	/** @param array<string, mixed> $asset */
	private function field(array $asset, string $field): mixed {
		/** @var array{model?: ?string} $exif */
		$exif = $asset['exifInfo'] ?? [];
		return match ($field) {
			'createdAt' => strtotime((string)$asset['createdAt']),
			'takenAt' => strtotime((string)$asset['fileCreatedAt']),
			'model' => $exif['model'] ?? null,
			'isMotion' => $asset['livePhotoVideoId'] !== null,
			'visibility' => $asset['visibility'] ?? 'timeline',
			default => $asset[$field] ?? null,
		};
	}

	/** @param array<string, mixed> $condition */
	private function holds(mixed $value, array $condition): bool {
		foreach ($condition as $op => $operand) {
			$operand = is_string($operand) && is_int($value) ? strtotime($operand) : $operand;
			$holds = match ($op) {
				'eq' => $value === $operand,
				'in' => in_array($value, (array)$operand, true),
				'lt' => $value < $operand,
				'lte' => $value <= $operand,
				'gte' => $value >= $operand,
				default => throw new \LogicException("The fake knows no filter op $op"),
			};
			if (!$holds) {
				return false;
			}
		}
		return true;
	}

	private function date(int $seconds): string {
		return (new \DateTimeImmutable("@$seconds"))->format('Y-m-d\TH:i:s.000\Z');
	}
}
