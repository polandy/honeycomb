<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Decision;

use OCA\Honeycomb\Domain\FileFlag;
use OCA\Honeycomb\Domain\Flag;
use OCA\Honeycomb\Domain\InvalidRequestException;
use OCA\Honeycomb\Domain\Limits;
use OCA\Honeycomb\Service\Decision\FlagService;
use OCA\Honeycomb\Tests\Service\FakeFlagStore;
use OCA\Honeycomb\Tests\Service\FakeUserPhotos;
use OCA\Honeycomb\Tests\Service\StatsFixture;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Constants;
use OCP\IUser;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** The sidecar ETag each file row keeps, as honeycomb last knew the sidecar (ADR 0056). */
final class FlagServiceSidecarEtagTest extends TestCase {
	use FakeUserPhotos;
	use StatsFixture;

	private const int NOW = 1_800_000_000;
	private const string TOO_LONG = 'e123456789e123456789e123456789e1234567890';

	private FakeFlagStore $store;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeFlagStore();
	}

	private function service(): FlagService {
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturn(self::NOW);
		$photos = $this->userPhotosWith([7 => Constants::PERMISSION_ALL, 8 => Constants::PERMISSION_ALL, 9 => Constants::PERMISSION_READ]);
		return new FlagService($this->store, $photos, $time, $this->stats());
	}

	private function user(): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		return $user;
	}

	// spec: DECISIONS-001.40
	public function testTheEtagsAreSetOnExistingRowsOnly(): void {
		$this->store->rows[7] = new FileFlag(7, Flag::Rejected, true, 100, 'bob');
		$this->store->rows[9] = new FileFlag(9, Flag::Picked, false, 100, 'bob', 'e1');

		$answer = $this->service()->sidecarEtags($this->user(), array_map(static fn (int $id): array => ['fileId' => $id, 'sidecarEtag' => 'e2'], [7, 8, 9, 10]));

		$this->assertEquals([7 => new FileFlag(7, Flag::Rejected, true, 100, 'bob', 'e2'), 9 => new FileFlag(9, Flag::Picked, false, 100, 'bob', 'e1')], $this->store->rows);
		$this->assertSame(['saved' => [7], 'skipped' => [
			['fileId' => 8, 'reason' => 'missing'],
			['fileId' => 9, 'reason' => 'notPermitted'],
			['fileId' => 10, 'reason' => 'notFound'],
		]], $answer->jsonSerialize());
	}

	// spec: DECISIONS-001.40
	public function testAnEtagMayBeForgotten(): void {
		$this->store->rows[7] = new FileFlag(7, Flag::Picked, false, 100, null, 'e1');

		$this->service()->sidecarEtags($this->user(), [['fileId' => 7, 'sidecarEtag' => null]]);

		$this->assertEquals([7 => new FileFlag(7, Flag::Picked, false, 100)], $this->store->rows);
	}

	/** @return array<string, array{array<array-key, mixed>}> */
	public static function malformed(): array {
		return [
			'not a list' => [['a' => ['fileId' => 7, 'sidecarEtag' => 'e1']]],
			'not an object' => [[7]],
			'no file id' => [[['sidecarEtag' => 'e1']]],
			'file id as text' => [[['fileId' => '7', 'sidecarEtag' => 'e1']]],
			'no etag' => [[['fileId' => 7]]],
			'etag as number' => [[['fileId' => 7, 'sidecarEtag' => 1]]],
			'empty etag' => [[['fileId' => 7, 'sidecarEtag' => '']]],
			'etag too long' => [[['fileId' => 7, 'sidecarEtag' => self::TOO_LONG]]],
			'a file id twice' => [[['fileId' => 7, 'sidecarEtag' => 'e1'], ['fileId' => 7, 'sidecarEtag' => 'e2']]],
			'too many' => [array_map(static fn (int $id): array => ['fileId' => $id, 'sidecarEtag' => 'e1'], range(1, Limits::ENTRIES + 1))],
		];
	}

	// spec: DECISIONS-001.40
	#[DataProvider('malformed')]
	public function testAMalformedRequestSetsNothing(array $items): void {
		$this->store->rows[7] = new FileFlag(7, Flag::Picked, false, 100);
		try {
			$this->service()->sidecarEtags($this->user(), $items);
			$this->fail('Expected InvalidRequestException');
		} catch (InvalidRequestException) {
			$this->assertSame(0, $this->store->writeCalls);
		}
	}

	// spec: DECISIONS-001.41
	public function testATakeOverRecordsTheSidecarEtagGiven(): void {
		$this->service()->takeOver($this->user(), [
			['fileId' => 7, 'flag' => 'picked', 'keepRaw' => false, 'sidecarEtag' => 'e1'],
			['fileId' => 8, 'flag' => 'rejected', 'keepRaw' => true],
		]);

		$this->assertEquals([
			7 => new FileFlag(7, Flag::Picked, false, self::NOW, 'alice', 'e1'),
			8 => new FileFlag(8, Flag::Rejected, true, self::NOW, 'alice'),
		], $this->store->rows);
	}

	// spec: DECISIONS-001.41
	public function testATakeOverWithAMalformedEtagWritesNothing(): void {
		$this->expectException(InvalidRequestException::class);

		$this->service()->takeOver($this->user(), [['fileId' => 7, 'flag' => 'picked', 'keepRaw' => false, 'sidecarEtag' => self::TOO_LONG]]);
	}
}
