<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Listing;

use OCA\Honeycomb\Service\Files\UserFolderResolver;
use OCA\Honeycomb\Service\Listing\EntryFactory;
use OCA\Honeycomb\Service\Listing\ListingService;
use OCA\Honeycomb\Service\Listing\RawExif;
use OCA\Honeycomb\Service\Listing\RawHeaderBackfill;
use OCA\Honeycomb\Service\Settings\SettingsService;
use OCA\Honeycomb\Tests\Service\FakeFiles;
use OCA\Honeycomb\Tests\Service\FakeFlagStore;
use OCA\Honeycomb\Tests\Service\FakeQualityStore;
use OCA\Honeycomb\Tests\Service\FakeVisualHashStore;
use OCP\BackgroundJob\IJobList;
use OCP\Config\IUserConfig;
use OCP\Files\File;
use OCP\FilesMetadata\IFilesMetadataManager;
use PHPUnit\Framework\TestCase;

final class ListingServiceBackfillTest extends TestCase {
	use FakeFiles;

	/** @var list<mixed> the arguments of the queued jobs */
	private array $queued = [];

	/** @param array<int, \OCP\FilesMetadata\Model\IFilesMetadata> $metadata */
	private function service(array $files, array $metadata, int $entryLimit): ListingService {
		$folder = $this->folder('/Photos');
		$folder->method('getDirectoryListing')->willReturn($files);
		$manager = $this->createStub(IFilesMetadataManager::class);
		$manager->method('getMetadataForFiles')->willReturnCallback(static fn (array $ids): array => array_intersect_key($metadata, array_flip($ids)));
		$jobs = $this->createStub(IJobList::class);
		$jobs->method('add')->willReturnCallback(function (string $class, mixed $argument): void {
			$this->queued[] = $argument;
		});
		$backfill = new RawHeaderBackfill($manager, $jobs, new SettingsService($this->createStub(IUserConfig::class)));
		return new ListingService(new UserFolderResolver($this->rootWith(['/Photos' => $folder])), new EntryFactory($manager, new FakeVisualHashStore(), new FakeFlagStore(), new FakeQualityStore()), $backfill, $entryLimit);
	}

	private function owned(int $id, string $path, string $owner = 'alice'): File {
		$file = $this->file($id, $path, 'image/x-dcraw');
		$file->method('getOwner')->willReturn($owner === 'alice' ? $this->user() : null);
		return $file;
	}

	// spec: LISTING-004.14
	public function testTheListingQueuesTheListedRawFilesWithoutTheKey(): void {
		$files = [
			$this->owned(1, '/Photos/IMG_0001.NEF'),
			$this->file(2, '/Photos/IMG_0001.JPG'),
			$this->owned(3, '/Photos/IMG_0002.NEF'),
			$this->owned(4, '/Photos/IMG_0003.NEF', 'bob'),
			$this->owned(5, '/Photos/IMG_0004.NEF'),
		];

		$this->service($files, [3 => $this->metadata([RawExif::KEY => []])], 4)->list($this->user(), 'Photos', false);

		$this->assertSame([['userId' => 'alice', 'fileIds' => [1]]], $this->queued);
	}
}
