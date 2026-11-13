<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\InvalidMoveRequestException;
use OCA\Honeycomb\Service\MoveService;
use OCA\Honeycomb\Service\TrashBinDisabledException;
use OCP\App\IAppManager;
use OCP\Files\AlreadyExistsException;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\Lock\LockedException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class MoveServiceTest extends TestCase {
	use FakeTree;

	private function service(bool $trashBin = true, ?LoggerInterface $logger = null): MoveService {
		$apps = $this->createStub(IAppManager::class);
		$apps->method('isEnabledForUser')->willReturnCallback(static fn (string $app): bool => $app === 'files_trashbin' && $trashBin);
		return new MoveService($this->treeRoot(), $apps, new FakeDecisionStore(), new FakeTagStore(), $logger ?? $this->createStub(LoggerInterface::class));
	}

	/** A RAW, its JPEG and the RAW's sidecar in `/In`, and a single JPEG. */
	private function pair(): void {
		$this->addFiles([1 => '/In/A.RAF', 2 => '/In/A.JPG', 3 => '/In/A.RAF.xmp', 4 => '/In/B.JPG']);
	}

	/**
	 * The request form of a file: its id, listed ETag and new path.
	 * @return array{fileId: int, etag: string, path: string}
	 */
	/** @return array{fileId: int, etag: string, path: string, replace?: array{fileId: int, etag: string}} */
	private static function to(int $fileId, string $path): array {
		return ['fileId' => $fileId, 'etag' => "etag-$fileId", 'path' => $path];
	}

	/**
	 * The pair's files to `/Out/2026`, the sidecar first, and the single JPEG to `/Out/B.JPG`.
	 * @return list<list<array{fileId: int, etag: string, path: string, replace?: array{fileId: int, etag: string}}>>
	 */
	private static function request(): array {
		return [
			[self::to(3, '/Out/2026/X.RAF.xmp'), self::to(1, '/Out/2026/X.RAF'), self::to(2, '/Out/2026/X.JPG')],
			[self::to(4, '/Out/B.JPG')],
		];
	}

	/** @return list<list<array<string, mixed>>> */
	private static function results(array $pictures): array {
		/** @var list<list<array<string, mixed>>> */
		return json_decode(json_encode($pictures, JSON_THROW_ON_ERROR), true, flags: JSON_THROW_ON_ERROR);
	}

	/** @return array{fileId: int, result: string, replaced: bool, path: string, newFileId: int, etag: string} */
	private static function moved(int $fileId, string $path, ?int $newFileId = null, bool $replaced = false): array {
		$newFileId ??= $fileId;
		return ['fileId' => $fileId, 'result' => 'moved', 'replaced' => $replaced, 'path' => $path, 'newFileId' => $newFileId, 'etag' => "etag-$newFileId"];
	}

	/** @return array{fileId: int, result: string, replaced: bool} */
	private static function failedFile(int $fileId, string $result, bool $replaced = false): array {
		return ['fileId' => $fileId, 'result' => $result, 'replaced' => $replaced];
	}

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
			'a storage error' => [new \RuntimeException('disk full'), 'failed'],
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
		$failure = new \RuntimeException('disk full');
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

	// spec: MOVE-002.8
	public function testAMalformedRequestTouchesNothing(): void {
		$this->pair();
		$this->expectException(InvalidMoveRequestException::class);

		try {
			$this->service()->move($this->treeUser(), [[self::to(1, '/Out/../X.RAF')]]);
		} finally {
			$this->assertSame([], $this->log);
		}
	}
}
