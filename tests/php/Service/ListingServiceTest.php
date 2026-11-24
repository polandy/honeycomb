<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\EntryFactory;
use OCA\Honeycomb\Service\FileFlag;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\FolderNotFoundException;
use OCA\Honeycomb\Service\FolderNotReadableException;
use OCA\Honeycomb\Service\Limits;
use OCA\Honeycomb\Service\ListingService;
use OCA\Honeycomb\Service\QualityValue;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\VisualHash;
use OCP\Files\File;
use OCP\Files\IRootFolder;
use OCP\Files\NotPermittedException;
use OCP\FilesMetadata\IFilesMetadataManager;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ListingServiceTest extends TestCase {
	use FakeFiles;

	private function service(IRootFolder $root, array $metadata = [], int $entryLimit = Limits::ENTRIES, FakeVisualHashStore $hashes = new FakeVisualHashStore(), FakeFlagStore $flags = new FakeFlagStore(), FakeQualityStore $quality = new FakeQualityStore()): ListingService {
		$manager = $this->createStub(IFilesMetadataManager::class);
		$manager->method('getMetadataForFiles')->willReturnCallback(
			static fn (array $ids): array => array_intersect_key($metadata, array_flip($ids)),
		);
		return new ListingService(new UserFolderResolver($root), new EntryFactory($manager, $hashes, $flags, $quality), $entryLimit);
	}

	// spec: LISTING-001.1
	public function testListsThePicturesFilesAndSidecarsOfTheFolderOnly(): void {
		$folder = $this->folder('/Photos');
		$folder->method('getDirectoryListing')->willReturn([
			$this->file(1, '/Photos/IMG_0001.JPG'),
			$this->file(2, '/Photos/IMG_0001.CR2', 'image/x-dcraw'),
			$this->file(3, '/Photos/IMG_0001.XMP', 'application/octet-stream'),
			$this->file(4, '/Photos/notes.txt', 'text/plain'),
			$this->file(5, '/Photos/._IMG_0001.JPG'),
			$this->folder('/Photos/2024'),
		]);

		$listing = $this->service($this->rootWith(['/Photos' => $folder]))->list($this->user(), 'Photos', false);

		$this->assertSame([1, 2, 3], array_column($this->entriesOf($listing), 'fileId'));
		$this->assertFalse($listing->jsonSerialize()['truncated']);
		// spec: LISTING-001.19
		$this->assertSame([['path' => '/Photos', 'permissions' => 31]], $listing->jsonSerialize()['folders']);
	}

	public function testNamesTheListedFolderByItsFileId(): void {
		$folder = $this->folder('/Photos', fileId: 42);
		$folder->method('getDirectoryListing')->willReturn([]);

		$listing = $this->service($this->rootWith(['/Photos' => $folder]))->list($this->user(), 'Photos', false);

		$this->assertSame(42, $listing->jsonSerialize()['fileId']);
	}

	// spec: LISTING-001.13
	public function testListsTheRawFilesNextcloudDoesNotTypeByName(): void {
		$folder = $this->folder('/Photos');
		$folder->method('getDirectoryListing')->willReturn([
			$this->file(1, '/Photos/IMG_0001.CR3', 'application/octet-stream'),
			$this->file(2, '/Photos/SAM_0002.srw', 'application/octet-stream'),
			$this->file(3, '/Photos/backup.bin', 'application/octet-stream'),
		]);

		$listing = $this->service($this->rootWith(['/Photos' => $folder]))->list($this->user(), 'Photos', false);

		$this->assertSame([1, 2], array_column($this->entriesOf($listing), 'fileId'));
	}

	// spec: LISTING-001.2
	public function testAnEntryCarriesTheFileAndItsExifBasics(): void {
		$folder = $this->folder('/Photos');
		$folder->method('getDirectoryListing')->willReturn([$this->file(7, '/Photos/IMG_0007.JPG')]);
		$metadata = [7 => $this->metadata([
			'photos-original_date_time' => 1_699_999_000,
			'photos-size' => ['width' => 6000, 'height' => 4000],
			'photos-ifd0' => ['Orientation' => 6, 'Make' => ' Canon ', 'Model' => 'EOS R5'],
		])];

		$listing = $this->service($this->rootWith(['/Photos' => $folder]), $metadata)->list($this->user(), '/Photos', false);

		$this->assertSame([[
			'fileId' => 7,
			'path' => '/Photos/IMG_0007.JPG',
			'size' => 1007,
			'mtime' => 1_700_000_007,
			'etag' => 'etag-7',
			'mime' => 'image/jpeg',
			'captureTime' => 1_699_999_000,
			'orientation' => 6,
			'width' => 6000,
			'height' => 4000,
			'camera' => 'Canon EOS R5',
			'visualHash' => null,
			'quality' => null,
			'exposure' => null,
			'flag' => null,
			'keepRaw' => null,
			'flagUpdated' => null,
			'sidecarEtag' => null,
		]], $this->entriesOf($listing));
	}

	// spec: SERIES-003.1, SERIES-003.2, SERIES-003.28
	public function testAnEntryCarriesTheStoredHashOfTheCurrentVersionWhoeverSavedIt(): void {
		$folder = $this->folder('/Photos');
		$folder->method('getDirectoryListing')->willReturn(array_map(fn (int $id): File => $this->file($id, "/Photos/IMG_$id.JPG"), [1, 2, 3, 4]));
		$hashes = new FakeVisualHashStore();
		$hashes->rows = [1 => new VisualHash(1, 'etag-1', 1, '0000000000000001'), 2 => new VisualHash(2, 'etag-old', 1, '0000000000000002'), 3 => new VisualHash(3, 'etag-3', 2, '0000000000000003')];

		$listing = $this->service($this->rootWith(['/Photos' => $folder]), hashes: $hashes)->list($this->user(), 'Photos', false);

		$this->assertSame([['method' => 1, 'hash' => '0000000000000001'], null, ['method' => 2, 'hash' => '0000000000000003'], null], array_column($this->entriesOf($listing), 'visualHash'));
		$this->assertSame([[1, 2, 3, 4]], $hashes->findCalls);
	}

	// spec: SERIES-006.6, SERIES-006.12
	public function testAnEntryCarriesTheStoredQualityValueOfTheCurrentVersionOnly(): void {
		$folder = $this->folder('/Photos');
		$folder->method('getDirectoryListing')->willReturn(array_map(fn (int $id): File => $this->file($id, "/Photos/IMG_$id.JPG"), [1, 2, 3]));
		$quality = new FakeQualityStore();
		$quality->rows = [1 => new QualityValue(1, 'etag-1', 1, 812.4, 27), 2 => new QualityValue(2, 'etag-old', 1, 90.0, 3)];

		$listing = $this->service($this->rootWith(['/Photos' => $folder]), quality: $quality)->list($this->user(), 'Photos', false);

		$this->assertSame([['method' => 1, 'sharpness' => 812.4, 'focusTile' => 27], null, null], array_column($this->entriesOf($listing), 'quality'));
		$this->assertSame([[1, 2, 3]], $quality->findCalls);
	}

	// spec: LISTING-001.18, DECISIONS-001.21
	public function testAnEntryCarriesTheFlagOfItsRow(): void {
		$folder = $this->folder('/Photos');
		$folder->method('getDirectoryListing')->willReturn([
			$this->file(1, '/Photos/IMG_1.JPG'),
			$this->file(2, '/Photos/IMG_2.JPG'),
			$this->file(3, '/Photos/IMG_1.XMP', 'application/octet-stream'),
		]);
		$flags = new FakeFlagStore();
		$flags->rows[1] = new FileFlag(1, Flag::Rejected, true, 1_800_000_000, null, 'e1');

		$entries = $this->entriesOf($this->service($this->rootWith(['/Photos' => $folder]), flags: $flags)->list($this->user(), 'Photos', false));

		$this->assertSame([['rejected', true, 1_800_000_000, 'e1'], [null, null, null, null], [null, null, null, null]], array_map(static fn (array $entry): array => [$entry['flag'], $entry['keepRaw'], $entry['flagUpdated'], $entry['sidecarEtag']], $entries));
	}

	// spec: LISTING-001.18
	public function testReadsTheFlagsOncePerThousandEntries(): void {
		$folder = $this->folder('/Photos');
		$folder->method('getDirectoryListing')->willReturn(array_map(fn (int $id): File => $this->file($id, "/Photos/IMG_$id.JPG"), range(1, 2_500)));
		$flags = new FakeFlagStore();

		$this->service($this->rootWith(['/Photos' => $folder]), flags: $flags)->list($this->user(), 'Photos', false);

		$this->assertSame([1_000, 1_000, 500], array_map(count(...), $flags->findCalls));
	}

	/** @return array<string, array{array<string, mixed>}> */
	public static function incompleteMetadata(): array {
		return [
			'none extracted' => [[]],
			'dimensions without height' => [['photos-size' => ['width' => 6000]]],
			'orientation not a number' => [['photos-ifd0' => ['Orientation' => 'top-left']]],
			'camera blank or not text' => [['photos-ifd0' => ['Make' => ' ', 'Model' => 5]]],
		];
	}

	// spec: LISTING-001.3
	#[DataProvider('incompleteMetadata')]
	public function testMissingExifIsNull(array $values): void {
		$folder = $this->folder('/Photos');
		$folder->method('getDirectoryListing')->willReturn([$this->file(8, '/Photos/IMG_0008.JPG'), $this->file(9, '/Photos/IMG_0009.JPG')]);

		$listing = $this->service($this->rootWith(['/Photos' => $folder]), [8 => $this->metadata($values)])
			->list($this->user(), 'Photos', false);

		foreach ($this->entriesOf($listing) as $json) {
			$this->assertNull($json['captureTime']);
			$this->assertNull($json['orientation']);
			$this->assertNull($json['width']);
			$this->assertNull($json['height']);
			$this->assertNull($json['camera']);
		}
	}

	// spec: LISTING-001.2
	public function testACameraWithOnlyAModelIsTheModel(): void {
		$folder = $this->folder('/Photos');
		$folder->method('getDirectoryListing')->willReturn([$this->file(7, '/Photos/IMG_0007.JPG')]);
		$metadata = [7 => $this->metadata(['photos-ifd0' => ['Model' => 'X100V']])];

		$listing = $this->service($this->rootWith(['/Photos' => $folder]), $metadata)->list($this->user(), '/Photos', false);

		$this->assertSame('X100V', $this->entriesOf($listing)[0]['camera']);
	}

	// spec: LISTING-001.6
	public function testStopsAtTheEntryLimitAndSaysSo(): void {
		$folder = $this->folder('/Photos');
		$folder->method('getDirectoryListing')->willReturn(array_map(
			fn (int $id): File => $this->file($id, "/Photos/IMG_$id.JPG"),
			[1, 2, 3],
		));

		$listing = $this->service($this->rootWith(['/Photos' => $folder]), [], 2)->list($this->user(), 'Photos', false);

		$this->assertSame([1, 2], array_column($this->entriesOf($listing), 'fileId'));
		$this->assertTrue($listing->jsonSerialize()['truncated']);
	}

	// spec: LISTING-001.6
	public function testAFolderExactlyAtTheLimitIsComplete(): void {
		$folder = $this->folder('/Photos');
		$folder->method('getDirectoryListing')->willReturn([$this->file(1, '/Photos/a.jpg'), $this->file(2, '/Photos/b.jpg')]);

		$listing = $this->service($this->rootWith(['/Photos' => $folder]), [], 2)->list($this->user(), 'Photos', false);

		$this->assertCount(2, $this->entriesOf($listing));
		$this->assertFalse($listing->jsonSerialize()['truncated']);
	}

	/** @return array<string, array{string}> */
	public static function foreignPaths(): array {
		return [
			'parent of the user folder' => ['../bob/files/Photos'],
			'parent inside the path' => ['Photos/../../bob/files'],
			'null byte' => ["Photos\0"],
		];
	}

	// spec: LISTING-001.7
	#[DataProvider('foreignPaths')]
	public function testAForeignPathIsNotFound(string $path): void {
		$root = $this->createMock(IRootFolder::class);
		$root->expects($this->never())->method('getUserFolder');

		$this->expectException(FolderNotFoundException::class);
		$this->service($root)->list($this->user(), $path, false);
	}

	// spec: LISTING-001.7
	public function testAFolderOutsideTheUserFolderIsNotFound(): void {
		$foreign = $this->createStub(\OCP\Files\Folder::class);
		$foreign->method('getPath')->willReturn('/bob/files/Photos');
		$foreign->method('isReadable')->willReturn(true);

		$this->expectException(FolderNotFoundException::class);
		$this->service($this->rootWith(['/Shared' => $foreign]))->list($this->user(), 'Shared', true);
	}

	// spec: LISTING-001.7
	public function testAVanishedFolderIsNotFound(): void {
		$this->expectException(FolderNotFoundException::class);
		$this->service($this->rootWith([]))->list($this->user(), 'Gone', false);
	}

	// spec: LISTING-001.7
	public function testAFileIsNotAFolder(): void {
		$this->expectException(FolderNotFoundException::class);
		$this->service($this->rootWith(['/a.jpg' => $this->file(1, '/a.jpg')]))->list($this->user(), 'a.jpg', false);
	}

	// spec: LISTING-001.8
	public function testAnUnreadableFolderIsNotReadable(): void {
		$this->expectException(FolderNotReadableException::class);
		$this->service($this->rootWith(['/Photos' => $this->folder('/Photos', false)]))->list($this->user(), 'Photos', false);
	}

	// spec: LISTING-001.8
	public function testAFolderThatMayNotBeOpenedIsNotReadable(): void {
		$this->expectException(FolderNotReadableException::class);
		$this->service($this->rootWith(['/Photos' => new NotPermittedException('Photos')]))->list($this->user(), 'Photos', false);
	}

	// spec: LISTING-001.8
	public function testAListingThatMayNotBeReadIsNotReadable(): void {
		$folder = $this->folder('/Photos');
		$folder->method('getDirectoryListing')->willThrowException(new NotPermittedException('Photos'));

		$this->expectException(FolderNotReadableException::class);
		$this->service($this->rootWith(['/Photos' => $folder]))->list($this->user(), 'Photos', false);
	}
}
