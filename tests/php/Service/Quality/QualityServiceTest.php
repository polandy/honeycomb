<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Quality;

use OCA\Honeycomb\Domain\InvalidRequestException;
use OCA\Honeycomb\Domain\QualityValue;
use OCA\Honeycomb\Service\Files\UserFolderResolver;
use OCA\Honeycomb\Service\Files\UserPhotos;
use OCA\Honeycomb\Service\Quality\QualityService;
use OCA\Honeycomb\Tests\Service\FakeFileIdSearch;
use OCA\Honeycomb\Tests\Service\FakeFiles;
use OCA\Honeycomb\Tests\Service\FakeQualityStore;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class QualityServiceTest extends TestCase {
	use FakeFiles;
	use FakeFileIdSearch;

	private FakeQualityStore $store;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeQualityStore();
	}

	/** A service whose user folder reaches `$nodes` by file id. */
	private function service(Node ...$nodes): QualityService {
		$byId = [];
		foreach ($nodes as $node) {
			$byId[$node->getId()] = $node;
		}
		$userFolder = $this->folder('');
		$find = static fn (int $id): ?Node => $byId[$id] ?? null;
		$userFolder->method('search')->willReturnCallback(self::fileIdSearch($find));
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		return new QualityService($this->store, new UserPhotos(new UserFolderResolver($root)));
	}

	/** @param array<string, mixed> $fields */
	private static function item(mixed $fileId, array $fields = []): array {
		return [...['fileId' => $fileId, 'etag' => "etag-$fileId", 'method' => 1, 'sharpness' => 812.4, 'focusTile' => 27], ...$fields];
	}

	// spec: SERIES-006.7
	public function testStoresTheValuesOfTheCurrentVersionsAndAnswersTheirIds(): void {
		$this->store->rows[8] = new QualityValue(8, 'etag-8', 1, 3.0, 0);
		$service = $this->service($this->file(7, '/P/A.JPG'), $this->file(8, '/P/B.CR3', 'image/x-dcraw'));

		$saved = $service->save($this->user(), [self::item(8, ['sharpness' => 90]), self::item(7)]);

		$this->assertSame([8, 7], $saved);
		$this->assertEquals([8 => new QualityValue(8, 'etag-8', 1, 90.0, 27), 7 => new QualityValue(7, 'etag-7', 1, 812.4, 27)], $this->store->rows);
	}

	// spec: SERIES-006.8
	public function testSkipsWhatTheUserCannotReachAsAPhotoAndOlderVersions(): void {
		$service = $this->service($this->file(7, '/P/A.JPG'), $this->file(6, '/P/C.JPG'), $this->file(9, '/P/A.XMP', 'application/octet-stream'));

		$saved = $service->save($this->user(), [self::item(404), self::item(7), self::item(9), self::item(6, ['etag' => 'etag-old'])]);

		$this->assertSame([7], $saved);
		$this->assertSame([7], array_keys($this->store->rows));
	}

	/** @return array<string, array{array<array-key, mixed>}> */
	public static function malformed(): array {
		return [
			'not a list' => [['a' => self::item(7)]],
			'item not an object' => [[7]],
			'file id a string' => [[self::item('7')]],
			'file id zero' => [[self::item(0)]],
			'etag empty' => [[self::item(7, ['etag' => ''])]],
			'etag too long' => [[self::item(7, ['etag' => str_repeat('a', 41)])]],
			'method zero' => [[self::item(7, ['method' => 0])]],
			'method too large' => [[self::item(7, ['method' => 256])]],
			'method a fraction' => [[self::item(7, ['method' => 1.5])]],
			'sharpness negative' => [[self::item(7, ['sharpness' => -0.1])]],
			'sharpness text' => [[self::item(7, ['sharpness' => '812'])]],
			'sharpness missing' => [[['fileId' => 7, 'etag' => 'etag-7', 'method' => 1, 'focusTile' => 0]]],
			'focus tile negative' => [[self::item(7, ['focusTile' => -1])]],
			'focus tile 64' => [[self::item(7, ['focusTile' => 64])]],
			'focus tile a fraction' => [[self::item(7, ['focusTile' => 2.5])]],
			'another item malformed' => [[self::item(7), self::item(8, ['focusTile' => 99])]],
			'file id twice' => [[self::item(7), self::item(7)]],
			'too many' => [array_map(static fn (int $id): array => self::item($id), range(1, QualityService::SAVE_LIMIT + 1))],
		];
	}

	// spec: SERIES-006.9
	#[DataProvider('malformed')]
	public function testAMalformedSaveWritesNothing(array $items): void {
		$service = $this->service($this->file(7, '/P/A.JPG'));

		try {
			$service->save($this->user(), $items);
			$this->fail('A malformed save was accepted');
		} catch (InvalidRequestException) {
			$this->assertSame(0, $this->store->replaceCalls);
		}
	}

	public function testAcceptsAWholeNumberAsSharpness(): void {
		$saved = $this->service($this->file(7, '/P/A.JPG'))->save($this->user(), [self::item(7, ['sharpness' => 0, 'focusTile' => 63])]);

		$this->assertSame([7], $saved);
		$this->assertEquals(new QualityValue(7, 'etag-7', 1, 0.0, 63), $this->store->rows[7]);
	}

	// spec: SERIES-006.13
	public function testRepeatsASaveThatLostARaceOnTheUniqueKey(): void {
		$this->store->failures = 1;

		$saved = $this->service($this->file(7, '/P/A.JPG'))->save($this->user(), [self::item(7)]);

		$this->assertSame([7], $saved);
		$this->assertSame(2, $this->store->replaceCalls);
	}

	public function testListsAValueByItsFields(): void {
		$this->assertSame(['method' => 1, 'sharpness' => 812.4, 'focusTile' => 27], (new QualityValue(7, 'etag-7', 1, 812.4, 27))->listed());
	}
}
