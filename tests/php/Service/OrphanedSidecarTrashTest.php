<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\InvalidTrashRequestException;
use OCA\Honeycomb\Service\OrphanedSidecarTrash;
use OCA\Honeycomb\Service\TrashBinDisabledException;
use OCA\Honeycomb\Service\TrashBinGuard;
use OCA\Honeycomb\Service\TrashNameSpacing;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCP\Files\GenericFileException;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\Lock\LockedException;
use OCP\App\IAppManager;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Config\IUserConfig;
use OCP\IAppConfig;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class OrphanedSidecarTrashTest extends TestCase {
	use FakeTree;

	private FakeClock $clock;

	#[\Override]
	protected function setUp(): void {
		$this->clock = new FakeClock();
	}

	private function service(bool $trashBin = true, ?LoggerInterface $logger = null): OrphanedSidecarTrash {
		$apps = $this->createStub(IAppManager::class);
		$apps->method('isEnabledForUser')->willReturnCallback(static fn (string $app): bool => $app === 'files_trashbin' && $trashBin);
		$userConfig = $this->createStub(IUserConfig::class);
		$userConfig->method('getValueString')->willReturnArgument(3);
		$appConfig = $this->createStub(IAppConfig::class);
		$appConfig->method('getValueString')->willReturn('-1');
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturnCallback(fn (): int => $this->clock->now);
		$spacing = new TrashNameSpacing($time, $this->clock);
		return new OrphanedSidecarTrash(new UserPhotos(new UserFolderResolver($this->treeRoot())), $apps, new TrashBinGuard($userConfig, $appConfig), $spacing, $logger ?? $this->createStub(LoggerInterface::class));
	}

	/**
	 * The request form of sidecars: each file id with its listed etag.
	 * @return list<array{fileId: int, etag: string}>
	 */
	private static function sidecars(int ...$fileIds): array {
		return array_values(array_map(static fn (int $id): array => ['fileId' => $id, 'etag' => "etag-$id"], $fileIds));
	}

	/**
	 * @param list<array{fileId: int, result: \OCA\Honeycomb\Service\TrashResult}> $results
	 * @return array<int, string>
	 */
	private static function byFile(array $results): array {
		return array_combine(array_column($results, 'fileId'), array_map(static fn (array $file): string => $file['result']->value, $results));
	}

	// spec: XMP-009.6
	public function testMovesTheConfirmedSidecarsToTheTrashBinInTheOrderSent(): void {
		$this->addFiles([1 => '/P/a.xmp', 2 => '/P/2024/b.CR2.xmp']);

		$results = $this->service()->trash($this->treeUser(), self::sidecars(2, 1));

		$this->assertSame([2 => 'trashed', 1 => 'trashed'], self::byFile($results));
		$this->assertSame([2, 1], $this->trashed);
	}

	// spec: XMP-009.7
	public function testSkipsASidecarWhoseMediaFileAppearedSinceTheScan(): void {
		$this->addFiles([1 => '/P/IMG.CR2.xmp', 2 => '/P/IMG.xmp', 3 => '/P/lone.xmp']);
		$this->addFiles([4 => '/P/img.cr2']);

		$results = $this->service()->trash($this->treeUser(), self::sidecars(1, 2, 3));

		$this->assertSame([1 => 'notOrphaned', 2 => 'notOrphaned', 3 => 'trashed'], self::byFile($results));
		$this->assertSame([3], $this->trashed);
	}

	// spec: XMP-009.8
	public function testSkipsAChangedForeignUndeletableUnrestorableOrSharedSidecar(): void {
		$this->addFiles([1 => '/P/a.xmp', 2 => '/P/b.JPG', 3 => '/P/c.xmp', 4 => '/P/d.xmp', 5 => '/P/shared/e.xmp']);
		$this->undeletable[3] = true;
		$this->noTrashBin[4] = true;
		$this->mounts['/P/shared'] = true;

		$results = $this->service()->trash($this->treeUser(), [['fileId' => 1, 'etag' => 'older'], ...self::sidecars(2, 99, 3, 4, 5)]);

		$this->assertSame([1 => 'changed', 2 => 'notFound', 99 => 'notFound', 3 => 'notPermitted', 4 => 'noTrashBin', 5 => 'notPermitted'], self::byFile($results));
		$this->assertSame([], $this->trashed);
	}

	// spec: XMP-009.6
	public function testTrashesSidecarsOfOneNameInDifferentSeconds(): void {
		$this->addFiles([1 => '/P/a.xmp', 2 => '/Q/a.xmp']);
		$this->service()->trash($this->treeUser(), self::sidecars(1, 2));

		$this->assertSame([1, 2], $this->trashed);
		$this->assertSame([101], $this->clock->pauses);
	}

	/** @return array<string, array{array<array-key, mixed>}> */
	public static function malformed(): array {
		return [
			'not a list' => [['a' => ['fileId' => 1, 'etag' => 'etag-1']]],
			'no etag' => [[['fileId' => 1]]],
			'no positive file id' => [[['fileId' => 0, 'etag' => 'e']]],
			'a file twice' => [[['fileId' => 1, 'etag' => 'etag-1'], ['fileId' => 1, 'etag' => 'etag-1']]],
			'too many' => [array_map(static fn (int $id): array => ['fileId' => $id, 'etag' => "etag-$id"], range(1, 501))],
		];
	}

	// spec: XMP-009.9
	#[DataProvider('malformed')]
	public function testAMalformedRequestTouchesNothing(array $sidecars): void {
		$this->addFiles([1 => '/P/a.xmp']);

		try {
			$this->service()->trash($this->treeUser(), $sidecars);
			$this->fail('A malformed request must be refused');
		} catch (InvalidTrashRequestException) {
			$this->assertSame([], $this->trashed);
		}
	}

	// spec: XMP-009.9
	public function testADisabledTrashBinTouchesNothing(): void {
		$this->addFiles([1 => '/P/a.xmp']);

		try {
			$this->service(trashBin: false)->trash($this->treeUser(), self::sidecars(1));
			$this->fail('A disabled trash bin must be refused');
		} catch (TrashBinDisabledException) {
			$this->assertSame([], $this->trashed);
		}
	}

	// spec: XMP-009.8
	public function testASidecarThatCannotBeDeletedIsReportedWithItsReason(): void {
		$this->addFiles([1 => '/P/a.xmp', 2 => '/P/b.xmp', 3 => '/P/c.xmp']);
		$this->deleteFailures = [1 => new NotPermittedException(), 2 => new LockedException('b.xmp'), 3 => new NotFoundException()];

		$results = $this->service()->trash($this->treeUser(), self::sidecars(1, 2, 3));

		$this->assertSame([1 => 'notPermitted', 2 => 'locked', 3 => 'notFound'], self::byFile($results));
	}

	// spec: XMP-009.8
	public function testAStorageErrorIsLoggedWithTheFileId(): void {
		$this->addFiles([1 => '/P/a.xmp']);
		$failure = new GenericFileException('disk full');
		$this->deleteFailures[1] = $failure;
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('warning')->with($this->anything(), ['fileId' => 1, 'exception' => $failure]);

		$results = $this->service(logger: $logger)->trash($this->treeUser(), self::sidecars(1));

		$this->assertSame([1 => 'failed'], self::byFile($results));
	}

	public function testAnUnexpectedFailureIsNotCaught(): void {
		$this->addFiles([1 => '/P/a.xmp']);
		$this->deleteFailures[1] = new \LogicException('bug');
		$this->expectException(\LogicException::class);

		$this->service()->trash($this->treeUser(), self::sidecars(1));
	}
}
