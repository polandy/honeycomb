<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\SemaphorePreviewLock;
use PHPUnit\Framework\TestCase;

final class SemaphorePreviewLockTest extends TestCase {
	// spec: IMAGES-001.18
	public function testAnswersTheRenderAndReleasesTheLockAfterAFailure(): void {
		$lock = new SemaphorePreviewLock();

		try {
			$lock->whileRendering(7, static fn (): never => throw new \RuntimeException('render failed'));
			$this->fail('The failure was swallowed');
		} catch (\RuntimeException $e) {
			$this->assertSame('render failed', $e->getMessage());
		}
		// a lock kept after the failure would block this second render for good
		$this->assertSame('rendered', $lock->whileRendering(7, static fn (): string => 'rendered'));
	}
}
