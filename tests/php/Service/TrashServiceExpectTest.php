<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FileFlag;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\InvalidTrashRequestException;
use OCP\Files\Node;
use OCP\Lock\LockedException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/** The trash endpoint's check against the flag rows and its removal of them (ADR 0040). */
final class TrashServiceExpectTest extends TestCase {
	use TrashServiceFixtures;

	/**
	 * A pair numbered from `$first`: the RAW, its sidecar, then the JPEG.
	 * @return array<int, Node>
	 */
	private function pair(int $first, ?\Throwable $rawFailure = null): array {
		$name = sprintf('IMG_%04d', $first);
		return [
			$first => $this->file($first, "$name.CR3", 'image/x-canon-cr3', failure: $rawFailure),
			$first + 1 => $this->file($first + 1, "$name.CR3.xmp", 'application/octet-stream'),
			$first + 2 => $this->file($first + 2, "$name.JPG"),
		];
	}

	/** Gives each file id a row with `$flag`. */
	private function flag(Flag $flag, bool $keepRaw, int ...$fileIds): void {
		foreach ($fileIds as $fileId) {
			$this->flags()->rows[$fileId] = new FileFlag($fileId, $flag, $keepRaw, 100);
		}
	}

	// spec: DELETE-001.15
	public function testTheRowsGoWithTheTrashedFilesAndStayForTheOthers(): void {
		$this->flag(Flag::Rejected, false, 1, 3);
		$this->flag(Flag::Picked, false, 9);

		$results = $this->service($this->pair(1, new LockedException('IMG_0001.CR3')))->trash($this->user(), [self::picture(3, 1, 2)], 'rejected');

		$this->assertSame([[['fileId' => 3, 'result' => 'trashed'], ['fileId' => 1, 'result' => 'locked'], ['fileId' => 2, 'result' => 'skipped']]], self::results($results));
		$this->assertSame([1, 9], array_keys($this->flags()->rows));
	}

	// spec: DELETE-001.15
	public function testTheRowsGoWithoutAnExpectationToo(): void {
		$this->flag(Flag::Picked, false, 1, 3);

		$this->service($this->pair(1))->trash($this->user(), [self::picture(1, 2, 3)]);

		$this->assertSame([], $this->flags()->rows);
	}

	// spec: DELETE-001.15
	public function testAFailedRemovalOfTheRowsIsLoggedAndTheAnswerStands(): void {
		$this->flag(Flag::Rejected, false, 1, 3);
		$this->flags()->removeFails = true;
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('error')->with($this->stringContains('flag'), $this->arrayHasKey('exception'));

		$results = $this->service($this->pair(1), logger: $logger)->trash($this->user(), [self::picture(1, 2, 3)], 'rejected');

		$this->assertSame(['trashed', 'trashed', 'trashed'], array_column(self::results($results)[0], 'result'));
		$this->assertSame([1, 3, 2], $this->trashed);
	}

	// spec: DELETE-001.16
	public function testAPictureWhoseDecisionChangedKeepsItsFilesAndRows(): void {
		$this->flag(Flag::Rejected, false, 1, 3, 4);
		$this->flag(Flag::Picked, false, 6);

		$results = $this->service($this->pair(1) + $this->pair(4))->trash($this->user(), [self::picture(1, 2, 3), self::picture(4, 5, 6)], 'rejected');

		$this->assertSame([
			[['fileId' => 1, 'result' => 'trashed'], ['fileId' => 2, 'result' => 'trashed'], ['fileId' => 3, 'result' => 'trashed']],
			[['fileId' => 4, 'result' => 'decisionChanged'], ['fileId' => 5, 'result' => 'decisionChanged'], ['fileId' => 6, 'result' => 'decisionChanged']],
		], self::results($results));
		$this->assertSame([1, 3, 2], $this->trashed);
		$this->assertSame([4, 6], array_keys($this->flags()->rows));
	}

	// spec: DELETE-001.16
	public function testAMemberWithoutARowIsNotRejected(): void {
		$this->flag(Flag::Rejected, false, 1);

		$results = $this->service($this->pair(1))->trash($this->user(), [self::picture(1, 2, 3)], 'rejected');

		$this->assertSame(['decisionChanged', 'decisionChanged', 'decisionChanged'], array_column(self::results($results)[0], 'result'));
		$this->assertSame([], $this->trashed);
	}

	// spec: DELETE-001.16
	public function testAFailedCheckOfAFileComesBeforeTheRows(): void {
		$this->flag(Flag::Picked, false, 1, 3);

		$results = $this->service($this->pair(1))->trash($this->user(), [[['fileId' => 1, 'etag' => 'stale'], ...self::picture(2, 3)]], 'rejected');

		$this->assertSame(['changed', 'skipped', 'skipped'], array_column(self::results($results)[0], 'result'));
	}

	// spec: DELETE-001.17
	public function testARawGoesOnlyWhileItIsNeitherKeptNorRejected(): void {
		$this->flag(Flag::Picked, false, 1);
		$this->flag(Flag::Unflagged, true, 4);
		$this->flag(Flag::Rejected, false, 7);
		$nodes = $this->pair(1) + $this->pair(4) + $this->pair(7) + $this->pair(10);

		$results = $this->service($nodes)->trash($this->user(), [self::picture(1, 2), self::picture(4, 5), self::picture(7, 8), self::picture(10, 11)], 'rawRemovable');

		$this->assertSame(
			[['trashed', 'trashed'], ['decisionChanged', 'decisionChanged'], ['decisionChanged', 'decisionChanged'], ['trashed', 'trashed']],
			array_map(static fn (array $picture): array => array_column($picture, 'result'), self::results($results)),
		);
		$this->assertSame([1, 2, 10, 11], $this->trashed);
	}

	/** @return array<string, array{mixed}> */
	public static function malformedExpectations(): array {
		return [
			'unknown' => ['picked'],
			'empty' => [''],
			'not a string' => [['rejected']],
		];
	}

	// spec: DELETE-001.18
	#[DataProvider('malformedExpectations')]
	public function testAMalformedExpectationTouchesNothing(mixed $expect): void {
		$this->flag(Flag::Rejected, false, 1, 3);
		$this->expectException(InvalidTrashRequestException::class);

		try {
			$this->service($this->pair(1))->trash($this->user(), [self::picture(1, 2, 3)], $expect);
		} finally {
			$this->assertSame([], $this->trashed);
		}
	}
}
