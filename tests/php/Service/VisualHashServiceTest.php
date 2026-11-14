<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\InvalidVisualHashException;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\VisualHash;
use OCA\Honeycomb\Service\VisualHashService;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class VisualHashServiceTest extends TestCase {
	use FakeFiles;

	private const string HASH = '00ff00ff00ff00ff';

	private FakeVisualHashStore $store;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeVisualHashStore();
	}

	/** A service whose user folder reaches `$nodes` by file id. */
	private function service(Node ...$nodes): VisualHashService {
		$byId = [];
		foreach ($nodes as $node) {
			$byId[$node->getId()] = $node;
		}
		$userFolder = $this->folder('');
		$userFolder->method('getFirstNodeById')->willReturnCallback(static fn (int $id): ?Node => $byId[$id] ?? null);
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		return new VisualHashService($this->store, new UserFolderResolver($root));
	}

	/** @return array{fileId: mixed, etag: mixed, hash: mixed} */
	private static function item(mixed $fileId, mixed $etag = null, mixed $hash = self::HASH): array {
		return ['fileId' => $fileId, 'etag' => $etag ?? "etag-$fileId", 'hash' => $hash];
	}

	// spec: SERIES-003.3
	public function testStoresTheHashesOfTheCurrentVersionsAndAnswersTheirIds(): void {
		$this->store->rows['alice'][8] = new VisualHash(8, 'etag-8', 'ffffffffffffffff');
		$service = $this->service($this->file(7, '/P/A.JPG'), $this->file(8, '/P/B.CR3', 'image/x-dcraw'));

		$saved = $service->save($this->user(), [self::item(8), self::item(7)]);

		$this->assertSame([8, 7], $saved);
		$this->assertEquals([8 => new VisualHash(8, 'etag-8', self::HASH), 7 => new VisualHash(7, 'etag-7', self::HASH)], $this->store->rows['alice']);
	}

	// spec: SERIES-003.4
	public function testSkipsWhatTheUserCannotReachAsAPhoto(): void {
		$folder = $this->folder('/P/Sub');
		$folder->method('getId')->willReturn(5);
		$service = $this->service($this->file(7, '/P/A.JPG'), $this->file(9, '/P/A.XMP', 'application/octet-stream'), $folder);

		$saved = $service->save($this->user(), [self::item(404), self::item(7), self::item(9), self::item(5)]);

		$this->assertSame([7], $saved);
		$this->assertSame([7], array_keys($this->store->rows['alice']));
	}

	// spec: SERIES-003.5
	public function testSkipsAHashOfAnOlderVersion(): void {
		$saved = $this->service($this->file(7, '/P/A.JPG'))->save($this->user(), [self::item(7, 'etag-old')]);

		$this->assertSame([], $saved);
		$this->assertSame([], $this->store->rows['alice'] ?? []);
	}

	/** @return array<string, array{mixed}> */
	public static function malformed(): array {
		return [
			'not a list' => [['a' => self::item(7)]],
			'another item malformed' => [[self::item(7), self::item(8, hash: 'zz')]],
			'item not an object' => [[7]],
			'file id a string' => [[self::item('7', 'etag-7')]],
			'file id zero' => [[self::item(0, 'etag-0')]],
			'etag missing' => [[['fileId' => 7, 'hash' => self::HASH]]],
			'etag empty' => [[self::item(7, '')]],
			'etag too long' => [[self::item(7, str_repeat('a', 41))]],
			'etag not text' => [[self::item(7, 7)]],
			'hash upper case' => [[self::item(7, hash: '00FF00FF00FF00FF')]],
			'hash too short' => [[self::item(7, hash: '00ff')]],
			'hash not text' => [[self::item(7, hash: 255)]],
			'file id twice' => [[self::item(7), self::item(7)]],
			'too many' => [array_map(static fn (int $id): array => self::item($id), range(1, VisualHashService::SAVE_LIMIT + 1))],
		];
	}

	// spec: SERIES-003.6
	#[DataProvider('malformed')]
	public function testAMalformedSaveWritesNothing(array $items): void {
		$service = $this->service($this->file(7, '/P/A.JPG'));

		try {
			$service->save($this->user(), $items);
			$this->fail('A malformed save was accepted');
		} catch (InvalidVisualHashException) {
			$this->assertSame(0, $this->store->replaceCalls);
		}
	}

	// spec: SERIES-003.9
	public function testRepeatsASaveThatLostARaceOnTheUniqueKey(): void {
		$this->store->failures = 1;

		$saved = $this->service($this->file(7, '/P/A.JPG'))->save($this->user(), [self::item(7)]);

		$this->assertSame([7], $saved);
		$this->assertSame(2, $this->store->replaceCalls);
	}
}
