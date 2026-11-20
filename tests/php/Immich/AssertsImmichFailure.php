<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Immich\ImmichError;
use OCA\Honeycomb\Immich\ImmichException;

/** Asserts that a call fails with one Immich error code. */
trait AssertsImmichFailure {
	/** @param \Closure(): mixed $call */
	private function assertFailsWith(ImmichError $error, \Closure $call): ImmichException {
		try {
			$call();
		} catch (ImmichException $failure) {
			$this->assertSame($error, $failure->error);
			return $failure;
		}
		$this->fail("Expected the {$error->value} failure");
	}
}
