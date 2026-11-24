<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Move;

use OCA\Honeycomb\Service\Trash\TrashBinDisabledException;
use OCP\Files\NotPermittedException;
use PHPUnit\Framework\TestCase;

/** A move that replaces a file at its target, with and without the trash bin. */
final class MoveServiceReplaceTest extends TestCase {
	use MoveFixture;

	// spec: MOVE-002.5
	public function testReplaceSendsTheTargetToTheTrashBin(): void {
		$this->pair();
		$this->addFiles([9 => '/Out/2026/X.JPG', 8 => '/Out/B.JPG']);
		$request = self::request();
		$request[0][2]['replace'] = ['fileId' => 9, 'etag' => 'etag-9'];
		$request[1][0]['replace'] = ['fileId' => 8, 'etag' => 'etag-old'];

		$results = $this->service()->move($this->treeUser(), $request);

		$this->assertSame([
			[self::moved(3, '/Out/2026/X.RAF.xmp'), self::moved(1, '/Out/2026/X.RAF'), self::moved(2, '/Out/2026/X.JPG', replaced: true)],
			[self::failedFile(4, 'exists')],
		], self::results($results));
		$this->assertSame([9], $this->trashed);
		$this->assertSame('/Out/B.JPG', $this->files[8]);
	}

	// spec: MOVE-002.5
	public function testReplaceOfAnotherFileOrAFreePathIsNoReplace(): void {
		$this->pair();
		$this->addFiles([9 => '/Out/X.JPG', 8 => '/Other/Y.JPG']);
		$jpeg = self::to(2, '/Out/X.JPG') + ['replace' => ['fileId' => 8, 'etag' => 'etag-8']];
		$single = self::to(4, '/Out/B.JPG') + ['replace' => ['fileId' => 8, 'etag' => 'etag-8']];

		$results = $this->service()->move($this->treeUser(), [[$jpeg], [$single]]);

		$this->assertSame([[self::failedFile(2, 'exists')], [self::moved(4, '/Out/B.JPG')]], self::results($results));
		$this->assertSame([], $this->trashed);
	}

	// spec: MOVE-002.5
	public function testAReplacedFileStaysInTheTrashBinWhenThePictureMovesBack(): void {
		$this->pair();
		$this->addFiles([9 => '/Out/2026/X.RAF']);
		$this->moveFailures[2] = new NotPermittedException();
		$request = self::request();
		$request[0][1]['replace'] = ['fileId' => 9, 'etag' => 'etag-9'];

		$results = $this->service()->move($this->treeUser(), [$request[0]]);

		$this->assertSame([[self::failedFile(3, 'skipped'), self::failedFile(1, 'movedBack', replaced: true), self::failedFile(2, 'notPermitted')]], self::results($results));
		$this->assertSame([9], $this->trashed);
	}

	// spec: MOVE-002.5
	public function testAReplaceTheTrashBinWouldNotKeepLeavesThePictureUntouched(): void {
		$this->pair();
		$this->addFiles([9 => '/Out/2026/X.JPG', 8 => '/Out/B.JPG']);
		$this->noTrashBin[9] = true;
		$request = self::request();
		$request[0][2]['replace'] = ['fileId' => 9, 'etag' => 'etag-9'];
		$request[1][0]['replace'] = ['fileId' => 8, 'etag' => 'etag-8'];

		$results = $this->service(trashBinSize: '800')->move($this->treeUser(), $request);

		$this->assertSame([
			[self::failedFile(3, 'skipped'), self::failedFile(1, 'skipped'), self::failedFile(2, 'noTrashBin')],
			[self::failedFile(4, 'tooLarge')],
		], self::results($results));
		$this->assertSame([], $this->trashed);
		$this->assertSame([], $this->log);
		$this->assertSame(['/Out/2026/X.JPG', '/Out/B.JPG'], [$this->files[9], $this->files[8]]);
	}

	// spec: MOVE-002.6
	public function testAFileAlreadyAtItsPathStays(): void {
		$this->pair();

		$results = $this->service()->move($this->treeUser(), [[self::to(2, '/In/A.JPG')]]);

		$this->assertSame([[self::moved(2, '/In/A.JPG')]], self::results($results));
		$this->assertSame([], $this->log);
	}

	// spec: MOVE-002.7
	public function testWithoutTheTrashBinAReplaceTouchesNothing(): void {
		$this->pair();
		$this->addFiles([9 => '/Out/X.JPG']);
		$this->expectException(TrashBinDisabledException::class);

		try {
			$this->service(trashBin: false)->move($this->treeUser(), [[self::to(4, '/Out/B.JPG')], [self::to(2, '/Out/X.JPG') + ['replace' => ['fileId' => 9, 'etag' => 'etag-9']]]]);
		} finally {
			$this->assertSame([], $this->log);
			$this->assertSame([], $this->trashed);
		}
	}

	// spec: MOVE-002.7
	public function testWithoutTheTrashBinAMoveWithoutReplaceGoesAhead(): void {
		$this->pair();

		$results = $this->service(trashBin: false)->move($this->treeUser(), [self::request()[1]]);

		$this->assertSame([[self::moved(4, '/Out/B.JPG')]], self::results($results));
	}
}
