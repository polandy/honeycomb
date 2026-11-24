<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCP\Files\GenericFileException;
use OCA\Honeycomb\Service\SidecarResult;
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
	public function testSavesAnExistingSidecarInPlaceWithoutTheRightToCreateFiles(): void {
		$this->creatable = false;

		$results = $this->writer()->save($this->user(), [$this->existing('new')]);

		$this->assertSame(['put IMG_0001.NEF.xmp'], $this->events);
		$this->assertSame(['IMG_0001.NEF' => 'raw', 'IMG_0001.NEF.xmp' => 'new', 'IMG_0002.JPG' => 'jpeg'], $this->disk);
		$this->assertSame([['result' => SidecarResult::Saved, 'fileId' => 9, 'etag' => md5('new'), 'size' => 3, 'mtime' => 1_700_000_001]], $results);
	}

	// spec: XMP-002.4
	public function testCreatesANewSidecarBesideItsImage(): void {
		$results = $this->writer()->save($this->user(), [$this->created('fresh')]);

		$this->assertSame(['write IMG_0002.JPG.xmp'], $this->events);
		$this->assertSame(['IMG_0001.NEF' => 'raw', 'IMG_0001.NEF.xmp' => 'old', 'IMG_0002.JPG' => 'jpeg', 'IMG_0002.JPG.xmp' => 'fresh'], $this->disk);
		$this->assertSame([['result' => SidecarResult::Saved, 'fileId' => self::NEW_ID, 'etag' => md5('fresh'), 'size' => 5, 'mtime' => 1_700_000_001]], $results);
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

		$this->creatable = false;
		$this->assertSame([SidecarResult::NotPermitted], $this->resultsOf($this->writer()->save($this->user(), [$this->created('fresh')])));

		$this->assertSame([], $this->events);
		$this->assertArrayNotHasKey('IMG_0002.JPG.xmp', $this->disk);
	}

	/** @return array<string, array{string, \Exception, SidecarResult}> */
	public static function storageFailures(): array {
		return [
			'not permitted while replacing' => ['putContent', new NotPermittedException('quota'), SidecarResult::NotPermitted],
			'locked while replacing' => ['putContent', new LockedException('IMG_0001.NEF.xmp'), SidecarResult::Locked],
			'vanished while replacing' => ['putContent', new NotFoundException('IMG_0001.NEF.xmp'), SidecarResult::NotFound],
			'storage error while replacing' => ['putContent', new GenericFileException('disk'), SidecarResult::Failed],
			'not permitted while creating' => ['newFile', new NotPermittedException('quota'), SidecarResult::NotPermitted],
			'locked while creating' => ['newFile', new LockedException('IMG_0002.JPG.xmp'), SidecarResult::Locked],
			'storage error while creating' => ['newFile', new GenericFileException('disk'), SidecarResult::Failed],
		];
	}

	// spec: XMP-002.6
	#[DataProvider('storageFailures')]
	public function testAStorageFailureWritesNothingElseAndTheOtherSidecarIsSaved(string $step, \Exception $failure, SidecarResult $expected): void {
		$this->failures[$step] = $failure;
		$sidecars = $step === 'putContent' ? [$this->existing('new'), $this->created('fresh')] : [$this->created('fresh'), $this->existing('new')];

		$results = $this->writer()->save($this->user(), $sidecars);

		$this->assertSame([$expected, SidecarResult::Saved], $this->resultsOf($results));
		$this->assertSame($step === 'putContent' ? ['write IMG_0002.JPG.xmp'] : ['put IMG_0001.NEF.xmp'], $this->events);
		$this->assertSame(['IMG_0001.NEF', 'IMG_0001.NEF.xmp', 'IMG_0002.JPG', ...($step === 'putContent' ? ['IMG_0002.JPG.xmp'] : [])], array_keys($this->disk));
	}

	// spec: XMP-002.6
	public function testAStorageErrorIsLoggedWithTheFileIdButNotThePath(): void {
		$this->failures['putContent'] = new GenericFileException('disk');
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('warning')->with($this->anything(), $this->callback(
			static fn (array $context): bool => $context['fileId'] === 9 && !array_key_exists('path', $context) && $context['exception'] instanceof GenericFileException,
		));

		$this->writer($logger)->save($this->user(), [$this->existing('new')]);
	}

	public function testAnUnexpectedFailureIsNotCaught(): void {
		$this->failures['putContent'] = new \LogicException('bug');
		$this->expectException(\LogicException::class);

		$this->writer()->save($this->user(), [$this->existing('new')]);
	}
}
