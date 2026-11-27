<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Listing;

use OCA\Honeycomb\BackgroundJob\ReadRawHeaders;
use OCA\Honeycomb\Service\Listing\RawExif;
use OCA\Honeycomb\Service\Listing\RawHeaderBackfill;
use OCA\Honeycomb\Service\Settings\SettingsService;
use OCP\BackgroundJob\IJobList;
use OCP\Config\IUserConfig;
use OCP\Files\File;
use OCP\FilesMetadata\IFilesMetadataManager;
use OCP\FilesMetadata\Model\IFilesMetadata;
use OCP\IUser;
use PHPUnit\Framework\TestCase;

final class RawHeaderBackfillTest extends TestCase {
	/** @var list<array{string, mixed}> the jobs added, as class and argument */
	private array $added = [];
	/** @var list<mixed> the arguments that already wait */
	private array $waiting = [];
	/** @var list<int> the file ids that have the key */
	private array $read = [];

	private function backfill(string $settings = '{}'): RawHeaderBackfill {
		$manager = $this->createStub(IFilesMetadataManager::class);
		$manager->method('getMetadataForFiles')->willReturnCallback(/** @param list<int> $ids */ function (array $ids): array {
			$metadata = [];
			foreach ($ids as $id) {
				$entry = $this->createStub(IFilesMetadata::class);
				$entry->method('hasKey')->willReturnCallback(fn (string $key): bool => $key === RawExif::KEY && in_array($id, $this->read, true));
				$metadata[$id] = $entry;
			}
			return $metadata;
		});
		$jobs = $this->createStub(IJobList::class);
		$jobs->method('has')->willReturnCallback(fn (string $class, mixed $argument): bool => $class === ReadRawHeaders::class && in_array($argument, $this->waiting, true));
		$jobs->method('add')->willReturnCallback(function (string $class, mixed $argument): void {
			$this->added[] = [$class, $argument];
		});
		$config = $this->createStub(IUserConfig::class);
		$config->method('getValueString')->willReturnCallback(static fn (string $userId, string $app, string $key, string $default = ''): string => $key === 'settings' ? $settings : $default);
		return new RawHeaderBackfill($manager, $jobs, new SettingsService($config));
	}

	private function user(string $userId = 'alice'): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn($userId);
		return $user;
	}

	private function file(int $id, string $name, ?string $owner = 'alice'): File {
		$file = $this->createStub(File::class);
		$file->method('getId')->willReturn($id);
		$file->method('getName')->willReturn($name);
		$file->method('getOwner')->willReturn($owner === null ? null : $this->user($owner));
		return $file;
	}

	// spec: LISTING-004.14
	public function testQueuesTheUsersOwnRawFilesWithoutTheKeySorted(): void {
		$this->read = [4];

		$this->backfill()->queueFiles($this->user(), [
			$this->file(7, 'b.NEF'),
			$this->file(3, 'a.jpg'),
			$this->file(2, 'a.cr3'),
			$this->file(4, 'c.nef'),
			$this->file(5, 'd.nef', 'bob'),
			$this->file(6, 'e.nef', null),
		]);

		$this->assertSame([[ReadRawHeaders::class, ['userId' => 'alice', 'fileIds' => [2, 7]]]], $this->added);
	}

	// spec: LISTING-004.14
	public function testQueuesOneJobPerFiveHundredFiles(): void {
		$rows = array_map(static fn (int $id): array => ['fileId' => $id, 'name' => "IMG_$id.NEF"], range(1_201, 1, -1));

		$this->backfill()->queueRows($this->user(), $rows);

		$this->assertSame([range(1, 500), range(501, 1_000), range(1_001, 1_201)], array_map(static fn (array $job): mixed => is_array($job[1]) ? $job[1]['fileIds'] : null, $this->added));
	}

	// spec: LISTING-004.14
	public function testLeavesOutAnExtensionTheUserRemovedFromTheRawList(): void {
		$this->backfill('{"rawExtensions": ["cr3"], "renderedExtensions": ["jpg"]}')->queueRows($this->user(), [['fileId' => 1, 'name' => 'a.nef'], ['fileId' => 2, 'name' => 'b.cr3']]);

		$this->assertSame([[ReadRawHeaders::class, ['userId' => 'alice', 'fileIds' => [2]]]], $this->added);
	}

	// spec: LISTING-004.14
	public function testQueuesNothingWithoutAnUnreadRawFile(): void {
		$this->read = [1];

		$this->backfill()->queueRows($this->user(), [['fileId' => 1, 'name' => 'a.nef'], ['fileId' => 2, 'name' => 'a.jpg']]);
		$this->backfill()->queueFiles($this->user(), []);

		$this->assertSame([], $this->added);
	}

	// spec: LISTING-004.16
	public function testDoesNotQueueAJobWhoseArgumentWaits(): void {
		$this->waiting = [['userId' => 'alice', 'fileIds' => [1]]];

		$this->backfill()->queueRows($this->user(), [['fileId' => 1, 'name' => 'a.nef']]);
		$this->backfill()->queueRows($this->user(), [['fileId' => 2, 'name' => 'b.nef']]);

		$this->assertSame([[ReadRawHeaders::class, ['userId' => 'alice', 'fileIds' => [2]]]], $this->added);
	}
}
