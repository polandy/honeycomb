<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

/** Immich's paged search over a list of assets: newest `fileCreatedAt` first, ties by id, an offset cursor, the `createdAt` bound. */
final class FakeImmichLibrary {
	/** @var list<array<string, mixed>> */
	public array $assets = [];

	/** An asset as Immich answers it, taken and received at unix seconds, with fields overridden. */
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
		/** @var array{size?: int, cursor?: string, filter?: array{createdAt?: array{lte?: string}}} $body */
		$body = json_decode((string)$options['body'], true, 512, JSON_THROW_ON_ERROR);
		$receivedBefore = $body['filter']['createdAt']['lte'] ?? null;
		$assets = array_values(array_filter($this->assets, static fn (array $asset): bool => $receivedBefore === null || strtotime((string)$asset['createdAt']) <= strtotime($receivedBefore)));
		usort($assets, static fn (array $a, array $b): int => [$b['fileCreatedAt'], $b['id']] <=> [$a['fileCreatedAt'], $a['id']]);
		$size = $body['size'] ?? 250;
		/** @var array{offset: int} $cursor */
		$cursor = isset($body['cursor']) ? json_decode(base64_decode(strtr($body['cursor'], '-_', '+/')), true, 512, JSON_THROW_ON_ERROR) : ['offset' => 0];
		$page = array_slice($assets, $cursor['offset'], $size);
		$next = $cursor['offset'] + $size < count($assets) ? rtrim(strtr(base64_encode((string)json_encode(['offset' => $cursor['offset'] + $size])), '+/', '-_'), '=') : null;
		$answer = ['albums' => ['count' => 0, 'facets' => [], 'items' => [], 'total' => 0], 'assets' => ['count' => count($page), 'facets' => [], 'items' => $page, 'nextCursor' => $next, 'nextPage' => null, 'total' => count($page)]];
		return [200, json_encode($answer, JSON_THROW_ON_ERROR), 'application/json'];
	}

	private function date(int $seconds): string {
		return (new \DateTimeImmutable("@$seconds"))->format('Y-m-d\TH:i:s.000\Z');
	}
}
