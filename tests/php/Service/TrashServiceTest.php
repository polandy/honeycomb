<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\InvalidTrashRequestException;
use OCA\Honeycomb\Service\ListingService;
use OCA\Honeycomb\Service\TrashBinDisabledException;
use OCA\Honeycomb\Service\TrashService;
use OCP\App\IAppManager;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\IUser;
use OCP\Lock\LockedException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class TrashServiceTest extends TestCase {
	/** @var list<int> file ids in the order they were trashed */
	private array $trashed = [];

	private function user(): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		return $user;
	}

	/** A file of alice's that records its delete, or throws `$failure` instead. */
	private function file(int $id, string $name, string $mime = 'image/jpeg', bool $deletable = true, ?\Throwable $failure = null): File {
		$file = $this->createStub(File::class);
		$file->method('getId')->willReturn($id);
		$file->method('getName')->willReturn($name);
		$file->method('getMimetype')->willReturn($mime);
		$file->method('getEtag')->willReturn("etag-$id");
		$file->method('isDeletable')->willReturn($deletable);
		$file->method('delete')->willReturnCallback(function () use ($id, $failure): void {
			if ($failure !== null) {
				throw $failure;
			}
			$this->trashed[] = $id;
		});
		return $file;
	}

	/** @param array<int, Node> $nodes alice's nodes by file id */
	private function service(array $nodes, bool $trashBin = true, ?LoggerInterface $logger = null): TrashService {
		$userFolder = $this->createStub(Folder::class);
		$userFolder->method('getFirstNodeById')->willReturnCallback(static fn (int $id): ?Node => $nodes[$id] ?? null);
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		$apps = $this->createStub(IAppManager::class);
		$apps->method('isEnabledForUser')->willReturnCallback(static fn (string $app): bool => $app === 'files_trashbin' && $trashBin);
		return new TrashService($root, $apps, $logger ?? $this->createStub(LoggerInterface::class));
	}

	/**
	 * The request form of a picture: each file id with its listed ETag.
	 * @return list<array{fileId: int, etag: string}>
	 */
	private static function picture(int ...$fileIds): array {
		return array_values(array_map(static fn (int $id): array => ['fileId' => $id, 'etag' => "etag-$id"], $fileIds));
	}

	/** @return list<list<array{fileId: int, result: string}>> */
	private static function results(array $pictures): array {
		/** @var list<list<array{fileId: int, result: string}>> */
		return json_decode(json_encode($pictures, JSON_THROW_ON_ERROR), true, flags: JSON_THROW_ON_ERROR);
	}

	/**
	 * A RAW, a JPEG and the RAW's sidecar, with the sidecar sent first.
	 * @return array<int, Node>
	 */
	private function pair(?\Throwable $jpegFailure = null): array {
		return [
			3 => $this->file(3, 'IMG_0001.CR3.xmp', 'application/octet-stream'),
			1 => $this->file(1, 'IMG_0001.CR3', 'image/x-canon-cr3'),
			2 => $this->file(2, 'IMG_0001.JPG', failure: $jpegFailure),
		];
	}

	// spec: DELETE-001.1
	public function testTrashesEveryFileOfEachPictureWithTheSidecarsLast(): void {
		$nodes = $this->pair() + [4 => $this->file(4, 'IMG_0002.JPG')];

		$results = $this->service($nodes)->trash($this->user(), [self::picture(3, 1, 2), self::picture(4)]);

		$this->assertSame([
			[['fileId' => 3, 'result' => 'trashed'], ['fileId' => 1, 'result' => 'trashed'], ['fileId' => 2, 'result' => 'trashed']],
			[['fileId' => 4, 'result' => 'trashed']],
		], self::results($results));
		$this->assertSame([1, 2, 3, 4], $this->trashed);
	}

	/** @return array<string, array{string, string}> */
	public static function checkFailures(): array {
		return [
			'a vanished or foreign file' => ['vanished', 'notFound'],
			'a folder' => ['folder', 'notFound'],
			'a file the listing does not list' => ['unlisted', 'notFound'],
			'a file changed since the listing' => ['changed', 'changed'],
			'a file the user may not delete' => ['undeletable', 'notPermitted'],
		];
	}

	// spec: DELETE-001.1
	public function testTrashesARawFileNextcloudDoesNotTypeWithItsJpeg(): void {
		$nodes = [1 => $this->file(1, 'IMG_0001.CR3', 'application/octet-stream'), 2 => $this->file(2, 'IMG_0001.JPG')];

		$results = $this->service($nodes)->trash($this->user(), [self::picture(1, 2)]);

		$this->assertSame([[['fileId' => 1, 'result' => 'trashed'], ['fileId' => 2, 'result' => 'trashed']]], self::results($results));
		$this->assertSame([1, 2], $this->trashed);
	}

	// spec: DELETE-001.2
	#[DataProvider('checkFailures')]
	public function testAFileThatFailsItsCheckLeavesTheWholePictureUntouched(string $jpeg, string $result): void {
		$nodes = [1 => $this->file(1, 'IMG_0001.CR3', 'image/x-canon-cr3'), 4 => $this->file(4, 'IMG_0002.JPG')];
		$node = match ($jpeg) {
			'vanished' => null,
			'folder' => $this->createStub(Folder::class),
			'unlisted' => $this->file(2, 'notes.txt', 'text/plain'),
			'changed', 'undeletable' => $this->file(2, 'IMG_0001.JPG', deletable: $jpeg !== 'undeletable'),
		};
		if ($node !== null) {
			$nodes[2] = $node;
		}
		$picture = [['fileId' => 1, 'etag' => 'etag-1'], ['fileId' => 2, 'etag' => $jpeg === 'changed' ? 'etag-old' : 'etag-2']];

		$results = $this->service($nodes)->trash($this->user(), [$picture, self::picture(4)]);

		$this->assertSame([
			[['fileId' => 1, 'result' => 'skipped'], ['fileId' => 2, 'result' => $result]],
			[['fileId' => 4, 'result' => 'trashed']],
		], self::results($results));
		$this->assertSame([4], $this->trashed);
	}

	/** @return array<string, array{\Throwable, string}> */
	public static function trashFailures(): array {
		return [
			'no permission' => [new NotPermittedException(), 'notPermitted'],
			'a lock' => [new LockedException('IMG_0001.JPG'), 'locked'],
			'vanished meanwhile' => [new NotFoundException(), 'notFound'],
			'a storage error' => [new \RuntimeException('disk full'), 'failed'],
		];
	}

	// spec: DELETE-001.3
	#[DataProvider('trashFailures')]
	public function testAFailedTrashStopsThePictureAndKeepsItsSidecars(\Throwable $failure, string $result): void {
		$nodes = $this->pair($failure) + [4 => $this->file(4, 'IMG_0002.JPG')];

		$results = $this->service($nodes)->trash($this->user(), [self::picture(3, 1, 2), self::picture(4)]);

		$this->assertSame([
			[['fileId' => 3, 'result' => 'skipped'], ['fileId' => 1, 'result' => 'trashed'], ['fileId' => 2, 'result' => $result]],
			[['fileId' => 4, 'result' => 'trashed']],
		], self::results($results));
		$this->assertSame([1, 4], $this->trashed);
	}

	// spec: DELETE-001.4
	public function testAStorageErrorIsLogged(): void {
		$failure = new \RuntimeException('disk full');
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('warning')->with($this->anything(), ['fileId' => 2, 'exception' => $failure]);

		$this->service($this->pair($failure), logger: $logger)->trash($this->user(), [self::picture(3, 1, 2)]);
	}

	// spec: DELETE-001.5
	public function testWithoutTheTrashBinNothingIsTouched(): void {
		$this->expectException(TrashBinDisabledException::class);

		try {
			$this->service($this->pair(), trashBin: false)->trash($this->user(), [self::picture(3, 1, 2)]);
		} finally {
			$this->assertSame([], $this->trashed);
		}
	}

	/** @return array<string, array{array<array-key, mixed>}> */
	public static function malformedRequests(): array {
		return [
			'no list' => [['a' => self::picture(1)]],
			'a picture that is no list' => [[['fileId' => 1, 'etag' => 'etag-1']]],
			'an empty picture' => [[[]]],
			'a file that is no object' => [[[1]]],
			'a file id that is no positive integer' => [[[['fileId' => 0, 'etag' => 'etag-0']]]],
			'a file id as a string' => [[[['fileId' => '1', 'etag' => 'etag-1']]]],
			'a missing ETag' => [[[['fileId' => 1]]]],
			'an empty ETag' => [[[['fileId' => 1, 'etag' => '']]]],
			'a file id twice in one picture' => [[self::picture(1, 1)]],
			'a file id in two pictures' => [[self::picture(1), self::picture(1)]],
			'more files than the limit' => [[self::picture(...range(1, ListingService::ENTRY_LIMIT + 1))]],
		];
	}

	// spec: DELETE-001.6
	#[DataProvider('malformedRequests')]
	public function testAMalformedRequestTouchesNothing(array $pictures): void {
		$this->expectException(InvalidTrashRequestException::class);

		try {
			$this->service($this->pair())->trash($this->user(), $pictures);
		} finally {
			$this->assertSame([], $this->trashed);
		}
	}

	// spec: DELETE-001.6
	public function testTheLimitItselfIsAccepted(): void {
		$results = $this->service([])->trash($this->user(), [self::picture(...range(1, ListingService::ENTRY_LIMIT))]);

		$this->assertCount(ListingService::ENTRY_LIMIT, $results[0]);
	}
}
