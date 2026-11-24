<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Image;

/** Lets one request at a time render a file's previews, as core rewrites a preview in place when two render it at once. */
interface PreviewLock {
	/**
	 * The result of `$render`, run while no other request renders the previews of file `$fileId` (IMAGES-001.18).
	 * @template T
	 * @param callable(): T $render
	 * @return T
	 */
	public function whileRendering(int $fileId, callable $render): mixed;
}
