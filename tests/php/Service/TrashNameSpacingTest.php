<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\TrashNameSpacing;
use OCP\AppFramework\Utility\ITimeFactory;
use PHPUnit\Framework\TestCase;

final class TrashNameSpacingTest extends TestCase {
	private FakeClock $clock;

	/** @var array<string, int> the second each trash call ran in, by its label */
	private array $ranAt = [];

	protected function setUp(): void {
		$this->clock = new FakeClock();
	}

	private function spacing(): TrashNameSpacing {
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturnCallback(fn (): int => $this->clock->now);
		return new TrashNameSpacing($time, $this->clock);
	}

	/** A trash call that records its second under `$label` and takes `$seconds`. */
	private function trash(string $label, int $seconds = 0): \Closure {
		return function () use ($label, $seconds): string {
			$this->ranAt[$label] = $this->clock->now;
			$this->clock->now += $seconds;
			return $label;
		};
	}

	// spec: DELETE-001.13
	public function testTrashesTheNextFileOfANameOnlyInTheNextSecond(): void {
		$spacing = $this->spacing();

		$this->assertTrue($spacing->clear(['IMG_0001.JPG']));
		$this->assertSame('first', $spacing->trash('IMG_0001.JPG', $this->trash('first')));
		$this->assertSame('other', $spacing->trash('IMG_0002.JPG', $this->trash('other')));
		$this->assertFalse($spacing->clear(['IMG_0002.JPG', 'IMG_0001.JPG']));
		$this->assertTrue($spacing->clear(['IMG_0003.JPG']));
		$this->assertSame('second', $spacing->trash('IMG_0001.JPG', $this->trash('second')));

		$this->assertSame(['first' => 100, 'other' => 100, 'second' => 101], $this->ranAt);
		$this->assertSame([101], $this->clock->pauses);
	}

	// spec: DELETE-001.13
	public function testADeleteThatCrossesASecondKeepsTheNameUntilTheSecondAfter(): void {
		$spacing = $this->spacing();

		$spacing->trash('IMG_0001.JPG', $this->trash('first', seconds: 1));
		$spacing->trash('IMG_0001.JPG', $this->trash('second'));

		$this->assertSame(['first' => 100, 'second' => 102], $this->ranAt);
		$this->assertSame([102], $this->clock->pauses);
	}

	// spec: DELETE-001.13
	public function testAFailedDeleteStillKeepsTheName(): void {
		$spacing = $this->spacing();

		try {
			$spacing->trash('IMG_0001.JPG', static fn (): never => throw new \RuntimeException('storage'));
			$this->fail('The failure must pass through');
		} catch (\RuntimeException $e) {
			$this->assertSame('storage', $e->getMessage());
		}

		$this->assertFalse($spacing->clear(['IMG_0001.JPG']));
	}

	// spec: DELETE-001.13
	public function testAwaitingTheNextSecondClearsEveryName(): void {
		$spacing = $this->spacing();
		$spacing->trash('IMG_0001.JPG', $this->trash('first'));

		$spacing->awaitNextSecond();

		$this->assertTrue($spacing->clear(['IMG_0001.JPG']));
		$this->assertSame(101, $this->clock->now);
	}
}
