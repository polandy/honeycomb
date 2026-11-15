<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\SidecarResult;
use OCP\Files\Folder;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\Lock\LockedException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/** The checked save against an in-memory folder `/alice/files/Photos`; validation is in SidecarRequestTest. */
final class SidecarWriterTest extends TestCase {
	use FakeSidecarFolder;

	// spec: XMP-002.3
	public function testSavesAnExistingSidecarThroughAPartFile(): void {
		$results = $this->writer()->save($this->user(), [$this->existing('new')]);

		$this->assertSame(['write IMG_0001.NEF.xmp.part', 'move IMG_0001.NEF.xmp.part'], $this->events);
		$this->assertSame('new', $this->disk['IMG_0001.NEF.xmp']);
		$this->assertArrayNotHasKey('IMG_0001.NEF.xmp.part', $this->disk);
		$this->assertSame([['result' => SidecarResult::Saved, 'fileId' => 9, 'etag' => md5('new'), 'size' => 3, 'mtime' => 1_700_000_002]], $results);
	}

	// spec: XMP-002.4
	public function testCreatesANewSidecarBesideItsImage(): void {
		$results = $this->writer()->save($this->user(), [$this->created('fresh')]);

		$this->assertSame(['write IMG_0002.JPG.xmp.part', 'move IMG_0002.JPG.xmp.part'], $this->events);
		$this->assertSame('fresh', $this->disk['IMG_0002.JPG.xmp']);
		$this->assertSame([['result' => SidecarResult::Saved, 'fileId' => self::NEW_ID, 'etag' => md5('fresh'), 'size' => 5, 'mtime' => 1_700_000_002]], $results);
	}

	// spec: XMP-002.5
	public function testASidecarChangedSinceItWasReadIsNotOverwritten(): void {
		$results = [
			...$this->writer()->save($this->user(), [$this->existing('new', etag: 'etag-seen'), $this->created('fresh', '/Photos/IMG_0001.NEF.xmp')]),
			...$this->writer()->save($this->user(), [$this->existing('new', size: 4)]),
		];

		$this->assertSame([SidecarResult::Changed, SidecarResult::Changed, SidecarResult::Changed], $this->resultsOf($results));
		$this->assertSame([], $this->events);
		$this->assertSame('old', $this->disk['IMG_0001.NEF.xmp']);
	}

	// spec: XMP-002.5
	public function testAnExistingSidecarChangedWhileThePartWasWrittenIsNotOverwritten(): void {
		$this->afterWrite = function (): void {
			$this->disk['IMG_0001.NEF.xmp'] = 'darktable';
		};

		$results = $this->writer()->save($this->user(), [$this->existing('new')]);

		$this->assertSame([SidecarResult::Changed], $this->resultsOf($results));
		$this->assertSame(['write IMG_0001.NEF.xmp.part', 'delete IMG_0001.NEF.xmp.part'], $this->events);
		$this->assertSame('darktable', $this->disk['IMG_0001.NEF.xmp']);
	}

	// spec: XMP-002.5
	public function testANewSidecarThatAppearedWhileThePartWasWrittenIsNotOverwritten(): void {
		$this->afterWrite = function (): void {
			$this->disk['IMG_0002.JPG.xmp'] = 'digikam';
		};

		$results = $this->writer()->save($this->user(), [$this->created('fresh')]);

		$this->assertSame([SidecarResult::Changed], $this->resultsOf($results));
		$this->assertSame(['write IMG_0002.JPG.xmp.part', 'delete IMG_0002.JPG.xmp.part'], $this->events);
		$this->assertSame('digikam', $this->disk['IMG_0002.JPG.xmp']);
	}

	// spec: XMP-002.6
	public function testReportsWhatItCannotFindAndSavesTheOthers(): void {
		$results = $this->writer()->save($this->user(), [
			['fileId' => 8, 'etag' => 'etag-8', 'size' => 3, 'content' => base64_encode('new')],
			$this->created('fresh', '/Photos/IMG_0003.JPG.xmp'),
			$this->created('fresh', '/Photos/IMG_0001.NEF.xmp.xmp'),
			$this->created('fresh'),
		]);

		$this->assertSame([SidecarResult::NotFound, SidecarResult::NotFound, SidecarResult::NotFound, SidecarResult::Saved], $this->resultsOf($results));
		$this->assertSame(['result'], array_keys($results[0]));
	}

	// spec: XMP-002.6
	public function testAnIdOfAnImageIsNotFound(): void {
		$this->disk = ['IMG_0001.NEF.xmp' => 'old'];
		$writer = $this->writer(nodeNamed: 'IMG_0001.JPG');

		$this->assertSame([SidecarResult::NotFound], $this->resultsOf($writer->save($this->user(), [$this->existing('new')])));
		$this->assertSame([], $this->events);
	}

	// spec: XMP-002.6
	public function testWithoutPermissionNothingIsWritten(): void {
		$this->updateable = false;
		$this->assertSame([SidecarResult::NotPermitted], $this->resultsOf($this->writer()->save($this->user(), [$this->existing('new')])));

		$this->updateable = true;
		$this->creatable = false;
		$results = $this->writer()->save($this->user(), [$this->existing('new'), $this->created('fresh')]);

		$this->assertSame([SidecarResult::NotPermitted, SidecarResult::NotPermitted], $this->resultsOf($results));
		$this->assertSame([], $this->events);
	}

	/** @return array<string, array{string, \Exception, SidecarResult, list<string>}> */
	public static function storageFailures(): array {
		return [
			'not permitted while writing' => ['newFile', new NotPermittedException('quota'), SidecarResult::NotPermitted, []],
			'locked while writing' => ['newFile', new LockedException('IMG_0001.NEF.xmp.part'), SidecarResult::Locked, []],
			'storage error while writing' => ['newFile', new \RuntimeException('disk'), SidecarResult::Failed, []],
			'locked while renaming' => ['move', new LockedException('IMG_0001.NEF.xmp'), SidecarResult::Locked, ['write IMG_0001.NEF.xmp.part', 'delete IMG_0001.NEF.xmp.part']],
			'vanished while renaming' => ['move', new NotFoundException('IMG_0001.NEF.xmp'), SidecarResult::NotFound, ['write IMG_0001.NEF.xmp.part', 'delete IMG_0001.NEF.xmp.part']],
			'storage error while renaming' => ['move', new \RuntimeException('disk'), SidecarResult::Failed, ['write IMG_0001.NEF.xmp.part', 'delete IMG_0001.NEF.xmp.part']],
		];
	}

	// spec: XMP-002.6
	#[DataProvider('storageFailures')]
	public function testAStorageFailureLeavesNoPartFile(string $step, \Exception $failure, SidecarResult $expected, array $events): void {
		$this->failures[$step] = $failure;

		$results = $this->writer()->save($this->user(), [$this->existing('new'), $this->created('fresh')]);

		$this->assertSame($expected, $results[0]['result']);
		$this->assertSame($events, array_slice($this->events, 0, count($events)));
		$this->assertSame('old', $this->disk['IMG_0001.NEF.xmp']);
		$this->assertSame([], array_filter(array_keys($this->disk), static fn (string $name): bool => str_ends_with($name, '.part')));
	}

	// spec: XMP-002.6
	public function testAStorageErrorIsLogged(): void {
		$this->failures['move'] = new \RuntimeException('disk');
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('warning')->with($this->anything(), $this->callback(
			static fn (array $context): bool => $context['path'] === self::FOLDER . '/IMG_0001.NEF.xmp' && $context['exception'] instanceof \RuntimeException,
		));

		$this->writer($logger)->save($this->user(), [$this->existing('new')]);
	}

	// spec: XMP-002.6
	public function testAPartFileThatCannotBeDeletedIsLoggedAndTheResultStays(): void {
		$this->failures['move'] = new LockedException('IMG_0001.NEF.xmp');
		$this->failures['delete'] = new \RuntimeException('disk');
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('warning');

		$this->assertSame([SidecarResult::Locked], $this->resultsOf($this->writer($logger)->save($this->user(), [$this->existing('new')])));
	}
}
