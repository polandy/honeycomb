<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\InvalidMoveRequestException;
use OCA\Honeycomb\Service\ListingService;
use OCA\Honeycomb\Service\MoveTargetService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class MoveTargetServiceTest extends TestCase {
	use FakeTree;

	// spec: MOVE-002.1
	public function testListsEveryChildOfEachTargetFolder(): void {
		$this->addFiles([1 => '/Out/a.RAF', 2 => '/Out/notes.txt', 3 => '/Out/2026/b.JPG', 4 => '/Hidden/c.JPG']);
		$this->unreadable['/Hidden'] = true;
		$service = new MoveTargetService($this->treeRoot());

		$folders = $service->targets($this->treeUser(), ['/Out', '/Out/2027', '/Out/a.RAF', '/Hidden', '/']);

		$this->assertSame([
			['path' => '/Out', 'children' => [
				['name' => '2026', 'fileId' => $this->folders['/Out/2026'], 'etag' => 'etag-folder/Out/2026'],
				['name' => 'a.RAF', 'fileId' => 1, 'etag' => 'etag-1'],
				['name' => 'notes.txt', 'fileId' => 2, 'etag' => 'etag-2'],
			]],
			['path' => '/Out/2027', 'children' => []],
			['path' => '/Out/a.RAF', 'children' => []],
			['path' => '/Hidden', 'children' => []],
			['path' => '/', 'children' => [
				['name' => 'Out', 'fileId' => $this->folders['/Out'], 'etag' => 'etag-folder/Out'],
				['name' => 'Hidden', 'fileId' => $this->folders['/Hidden'], 'etag' => 'etag-folder/Hidden'],
			]],
		], $folders);
	}

	/** @return array<string, array{array<array-key, mixed>}> */
	public static function malformedRequests(): array {
		return [
			'no list' => [['a' => '/Out']],
			'a path that is no string' => [[7]],
			'a relative path' => [['Out']],
			'a dot-dot segment' => [['/Out/..']],
			'more folders than the limit' => [array_fill(0, ListingService::ENTRY_LIMIT + 1, '/Out')],
		];
	}

	// spec: MOVE-002.8
	#[DataProvider('malformedRequests')]
	public function testAMalformedProbeIsRefused(array $folders): void {
		$this->expectException(InvalidMoveRequestException::class);

		(new MoveTargetService($this->treeRoot()))->targets($this->treeUser(), $folders);
	}
}
