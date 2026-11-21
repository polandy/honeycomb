<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\SemaphorePreviewLock;
use PHPUnit\Framework\TestCase;

final class SemaphorePreviewLockTest extends TestCase {
	/** A render that fails. */
	private static function failingRender(): string {
		throw new \RuntimeException('render failed');
	}

	// spec: IMAGES-001.18
	public function testAnswersTheRenderAndReleasesTheLockAfterAFailure(): void {
		$lock = new SemaphorePreviewLock();
		$failure = null;

		try {
			$lock->whileRendering(7, self::failingRender(...));
		} catch (\RuntimeException $e) {
			$failure = $e->getMessage();
		}

		$this->assertSame('render failed', $failure);
		// a lock kept after the failure would block this second render for good
		$this->assertSame('rendered', $lock->whileRendering(7, static fn (): string => 'rendered'));
	}
}
