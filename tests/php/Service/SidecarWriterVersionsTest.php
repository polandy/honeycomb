<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\SidecarResult;
use PHPUnit\Framework\TestCase;

final class SidecarWriterVersionsTest extends TestCase {
	use FakeSidecarFolder;

	// spec: XMP-002.10
	public function testAnExistingSidecarIsNotOverwrittenWithoutFileVersionsButANewOneIsCreated(): void {
		$this->versions = false;

		$results = $this->writer()->save($this->user(), [$this->existing('new'), $this->created('fresh')]);

		$this->assertSame([SidecarResult::NoVersions, SidecarResult::Saved], $this->resultsOf($results));
		$this->assertSame('old', $this->disk['IMG_0001.NEF.xmp']);
		$this->assertSame(['write IMG_0002.JPG.xmp.part', 'move IMG_0002.JPG.xmp.part'], $this->events);
	}

	// spec: XMP-002.10
	public function testTheVersionsOfTheSidecarsOwnerCountNotTheUsers(): void {
		$this->owner = 'bob';
		$this->versions = false;

		$results = $this->writer()->save($this->user(), [$this->existing('new')]);

		$this->assertSame([SidecarResult::NoVersions], $this->resultsOf($results));
		$this->assertSame('old', $this->disk['IMG_0001.NEF.xmp']);
	}

	// spec: XMP-002.10
	public function testAChangedOrForbiddenSidecarAnswersItsOwnResultWithoutFileVersions(): void {
		$this->versions = false;
		$changed = $this->writer()->save($this->user(), [$this->existing('new', etag: 'etag-seen')]);
		$this->updateable = false;
		$forbidden = $this->writer()->save($this->user(), [$this->existing('new')]);

		$this->assertSame([SidecarResult::Changed, SidecarResult::NotPermitted], $this->resultsOf([...$changed, ...$forbidden]));
		$this->assertSame([], $this->events);
	}
}
