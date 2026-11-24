<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Move;

use OCA\Honeycomb\Domain\InvalidRequestException;
use OCP\Files\AlreadyExistsException;
use OCP\Files\GenericFileException;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\Lock\LockedException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class MoveServiceTest extends TestCase {
	use MoveFixture;

	// spec: MOVE-002.2
	public function testMovesEveryFileOfEachPictureIntoCreatedFoldersWithTheSidecarsLast(): void {
		$this->pair();
		$this->newIds[4] = 40;

		$results = $this->service()->move($this->treeUser(), self::request());

		$this->assertSame([
			[self::moved(3, '/Out/2026/X.RAF.xmp'), self::moved(1, '/Out/2026/X.RAF'), self::moved(2, '/Out/2026/X.JPG')],
			[self::moved(4, '/Out/B.JPG', 40)],
		], self::results($results));
		$this->assertSame([
			'mkdir /Out', 'mkdir /Out/2026', 'move 1 /Out/2026/X.RAF', 'move 2 /Out/2026/X.JPG', 'move 3 /Out/2026/X.RAF.xmp', 'move 4 /Out/B.JPG',
		], $this->log);
	}

	/** @return array<string, array{string, string}> */
	public static function checkFailures(): array {
		return [
			'a vanished or foreign file' => ['vanished', 'notFound'],
			'a file the listing does not list' => ['unlisted', 'notFound'],
			'a file changed since the listing' => ['changed', 'changed'],
			'a file the user may not delete' => ['undeletable', 'notPermitted'],
			'a taken target' => ['taken', 'exists'],
			'a target below a file' => ['belowFile', 'exists'],
			'a target folder without create permission' => ['readOnly', 'notPermitted'],
			'a target below a folder the user may not read' => ['unreadable', 'notPermitted'],
		];
	}

	// spec: MOVE-002.3
	#[DataProvider('checkFailures')]
	public function testAFileThatFailsItsCheckLeavesTheWholePictureUntouched(string $case, string $result): void {
		$this->pair();
		$this->addFiles([5 => '/Out/Taken.JPG', 6 => '/Out/File']);
		$this->addFolder('/Out/Locked');
		$this->addFolder('/Hidden/Deep');
		$target = match ($case) {
			'taken' => '/Out/Taken.JPG',
			'belowFile' => '/Out/File/X.JPG',
			'readOnly' => '/Out/Locked/X.JPG',
			'unreadable' => '/Hidden/Deep/X.JPG',
			default => '/Out/X.JPG',
		};
		match ($case) {
			'vanished' => $this->files = array_diff_key($this->files, [2 => true]),
			'unlisted' => $this->files[2] = '/In/A.txt',
			'undeletable' => $this->undeletable[2] = true,
			'readOnly' => $this->readOnly['/Out/Locked'] = true,
			'unreadable' => $this->unreadable['/Hidden'] = true,
			default => null,
		};
		$jpeg = ['fileId' => 2, 'etag' => $case === 'changed' ? 'etag-old' : 'etag-2', 'path' => $target];

		$results = $this->service()->move($this->treeUser(), [[self::to(1, '/Out/X.RAF'), $jpeg], [self::to(4, '/Out/B.JPG')]]);

		$this->assertSame([
			[self::failedFile(1, 'skipped'), self::failedFile(2, $result)],
			[self::moved(4, '/Out/B.JPG')],
		], self::results($results));
		$this->assertSame('/In/A.RAF', $this->files[1]);
		$this->assertSame(['move 4 /Out/B.JPG'], $this->log);
	}

	/** @return array<string, array{\Throwable, string}> */
	public static function moveFailures(): array {
		return [
			'no permission' => [new NotPermittedException(), 'notPermitted'],
			'a lock' => [new LockedException('A.JPG'), 'locked'],
			'vanished meanwhile' => [new NotFoundException(), 'notFound'],
			'taken meanwhile' => [new AlreadyExistsException(), 'exists'],
			'a storage error' => [new GenericFileException('disk full'), 'failed'],
		];
	}

	// spec: MOVE-002.4
	#[DataProvider('moveFailures')]
	public function testAFailedMoveMovesThePictureBack(\Throwable $failure, string $result): void {
		$this->pair();
		$this->moveFailures[2] = $failure;

		$results = $this->service()->move($this->treeUser(), self::request());

		$this->assertSame([
			[self::failedFile(3, 'skipped'), self::failedFile(1, 'movedBack'), self::failedFile(2, $result)],
			[self::moved(4, '/Out/B.JPG')],
		], self::results($results));
		$this->assertSame(['/In/A.RAF', '/In/A.JPG', '/In/A.RAF.xmp'], [$this->files[1], $this->files[2], $this->files[3]]);
	}

	// spec: MOVE-002.4
	public function testAStorageErrorIsLogged(): void {
		$this->pair();
		$failure = new GenericFileException('disk full');
		$this->moveFailures[3] = $failure;
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('warning')->with($this->anything(), ['fileId' => 3, 'exception' => $failure]);

		$this->service(logger: $logger)->move($this->treeUser(), [self::request()[0]]);
	}

	// spec: MOVE-002.4
	public function testAFileThatCannotGoBackStaysMovedAndIsLogged(): void {
		$this->pair();
		$this->newIds[1] = 10;
		$this->moveFailures[3] = new NotPermittedException();
		$failure = new LockedException('X.RAF');
		$this->moveFailures[10] = $failure;
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('warning')->with($this->anything(), ['fileId' => 10, 'exception' => $failure]);

		$results = $this->service(logger: $logger)->move($this->treeUser(), [self::request()[0]]);

		$this->assertSame([[self::failedFile(3, 'notPermitted'), self::moved(1, '/Out/2026/X.RAF', 10), self::failedFile(2, 'movedBack')]], self::results($results));
		$this->assertSame(['/Out/2026/X.RAF', '/In/A.JPG'], [$this->files[10], $this->files[2]]);
	}
	// spec: MOVE-002.8
	public function testAMalformedRequestTouchesNothing(): void {
		$this->pair();
		$this->expectException(InvalidRequestException::class);

		try {
			$this->service()->move($this->treeUser(), [[self::to(1, '/Out/../X.RAF')]]);
		} finally {
			$this->assertSame([], $this->log);
		}
	}
}
