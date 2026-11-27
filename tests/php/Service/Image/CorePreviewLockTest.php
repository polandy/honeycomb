<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Image;

use OCA\Honeycomb\Service\Image\CorePreviewLock;
use OCA\Honeycomb\Tests\Service\FakeClock;
use OCA\Honeycomb\Tests\Service\FakeLockingProvider;
use OCP\Lock\ILockingProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class CorePreviewLockTest extends TestCase {
	private const string KEY = 'honeycomb/preview/7';

	private FakeClock $clock;

	#[\Override]
	protected function setUp(): void {
		$this->clock = new FakeClock();
	}

	private function lock(FakeLockingProvider $locks, ?LoggerInterface $logger = null): CorePreviewLock {
		return new CorePreviewLock($locks, $this->clock, $logger ?? $this->createStub(LoggerInterface::class));
	}

	/** A render that fails. */
	private static function failingRender(): string {
		throw new \RuntimeException('render failed');
	}

	// spec: IMAGES-001.18
	public function testRendersUnderTheFilesExclusiveLockAndFreesIt(): void {
		$locks = new FakeLockingProvider();
		$heldWhileRendering = null;
		$preview = new \stdClass();

		$result = $this->lock($locks)->whileRendering(7, function () use ($locks, &$heldWhileRendering, $preview): \stdClass {
			$heldWhileRendering = $locks->held;
			return $preview;
		});

		$this->assertSame($preview, $result);
		$this->assertSame([self::KEY => ILockingProvider::LOCK_EXCLUSIVE], $heldWhileRendering);
		$this->assertSame([], $locks->held);
		$this->assertSame([self::KEY], $locks->released);
		$this->assertSame([], $this->clock->waits);
	}

	// spec: IMAGES-001.19
	public function testFreesTheLockAfterAFailedRender(): void {
		$locks = new FakeLockingProvider();
		$failure = null;

		try {
			$this->lock($locks)->whileRendering(7, self::failingRender(...));
		} catch (\RuntimeException $e) {
			$failure = $e->getMessage();
		}

		$this->assertSame('render failed', $failure);
		$this->assertSame([], $locks->held);
		$this->assertSame([self::KEY], $locks->released);
	}

	// spec: IMAGES-001.19
	public function testTriesAgainEvery50MillisecondsUntilAnotherRequestFreesTheLock(): void {
		$locks = new FakeLockingProvider(otherHoldsFor: 3);
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->never())->method('warning');
		$heldWhileRendering = null;

		$this->lock($locks, $logger)->whileRendering(7, function () use ($locks, &$heldWhileRendering): string {
			$heldWhileRendering = $locks->held;
			return 'rendered';
		});

		$this->assertSame([50, 50, 50], $this->clock->waits);
		$this->assertSame([], $this->clock->pauses);
		$this->assertSame([self::KEY => ILockingProvider::LOCK_EXCLUSIVE], $heldWhileRendering);
		$this->assertSame(4, $locks->attempts);
		$this->assertSame([self::KEY], $locks->released);
	}

	// spec: IMAGES-001.20
	public function testRendersWithoutTheLockOnceItStaysHeldForThirtySeconds(): void {
		$locks = new FakeLockingProvider(otherHoldsFor: PHP_INT_MAX);
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('warning')
			->with($this->anything(), $this->equalTo(['fileId' => 7, 'waitedSeconds' => 30]));

		$preview = new \stdClass();

		$result = $this->lock($locks, $logger)->whileRendering(7, fn (): \stdClass => $preview);

		$this->assertSame($preview, $result);
		$this->assertSame(array_fill(0, 600, 50), $this->clock->waits);
		$this->assertSame(601, $locks->attempts);
		$this->assertSame([], $locks->released);
	}

	// spec: IMAGES-001.20
	public function testFailsTheRenderWithoutTheLockAndFreesNothing(): void {
		$locks = new FakeLockingProvider(otherHoldsFor: PHP_INT_MAX);
		$this->expectExceptionMessage('render failed');

		try {
			$this->lock($locks)->whileRendering(7, self::failingRender(...));
		} finally {
			$this->assertSame([], $locks->released);
		}
	}
}
