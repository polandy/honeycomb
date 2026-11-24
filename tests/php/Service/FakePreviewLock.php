<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\Image\PreviewLock;

/** A lock that records which file it holds while a render runs. */
final class FakePreviewLock implements PreviewLock {
	/** The file whose lock is held, or null between renders. */
	public ?int $held = null;

	#[\Override]
	public function whileRendering(int $fileId, callable $render): mixed {
		$this->held = $fileId;
		try {
			return $render();
		} finally {
			$this->held = null;
		}
	}
}
