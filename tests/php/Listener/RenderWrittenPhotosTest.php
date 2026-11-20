<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Listener;

use OCA\Honeycomb\BackgroundJob\RenderPhotoTiers;
use OCA\Honeycomb\Listener\RenderWrittenPhotos;
use OCA\Honeycomb\Service\AppVisits;
use OCP\BackgroundJob\IJobList;
use OCP\Config\IUserConfig;
use OCP\EventDispatcher\Event;
use OCP\Files\Events\Node\NodeWrittenEvent;
use OCP\Files\File;
use OCP\Files\Folder;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class RenderWrittenPhotosTest extends TestCase {
	/** @var list<array{string, mixed}> the jobs queued, by class and argument */
	private array $queued = [];

	private function listener(): RenderWrittenPhotos {
		$jobs = $this->createStub(IJobList::class);
		$jobs->method('has')->willReturnCallback(fn (string $class, mixed $argument): bool => in_array([$class, $argument], $this->queued, true));
		$jobs->method('add')->willReturnCallback(function (string $class, mixed $argument): void {
			$this->queued[] = [$class, $argument];
		});
		$config = $this->createStub(IUserConfig::class);
		$config->method('getValueBool')->willReturnCallback(static fn (string $userId): bool => $userId === 'alice');
		return new RenderWrittenPhotos(new AppVisits($config), $jobs);
	}

	private function file(string $path, string $mime = 'image/jpeg', int $id = 7): File {
		$file = $this->createStub(File::class);
		$file->method('getId')->willReturn($id);
		$file->method('getPath')->willReturn($path);
		$file->method('getName')->willReturn(basename($path));
		$file->method('getMimetype')->willReturn($mime);
		return $file;
	}

	// spec: IMAGES-001.16
	public function testQueuesOneJobPerWrittenPhotoOfAUserWhoOpenedHoneycomb(): void {
		$listener = $this->listener();

		$listener->handle(new NodeWrittenEvent($this->file('/alice/files/Trip/IMG_0001.jpg')));
		$listener->handle(new NodeWrittenEvent($this->file('/alice/files/Trip/IMG_0001.jpg')));
		$listener->handle(new NodeWrittenEvent($this->file('/alice/files/Trip/IMG_0001.CR3', 'application/octet-stream', 8)));

		$this->assertSame([
			[RenderPhotoTiers::class, ['userId' => 'alice', 'fileId' => 7]],
			[RenderPhotoTiers::class, ['userId' => 'alice', 'fileId' => 8]],
		], $this->queued);
	}

	/** @return array<string, array{string, ?string}> the path and the MIME type of each write, null for a folder */
	public static function otherWrites(): array {
		return [
			'a folder' => ['/alice/files/Trip', null],
			'no photo' => ['/alice/files/Trip/IMG_0001.xmp', 'application/octet-stream'],
			'a text file' => ['/alice/files/notes.txt', 'text/plain'],
			'the trash bin' => ['/alice/files_trashbin/files/IMG_0001.jpg.d1', 'image/jpeg'],
			'app data' => ['/appdata_oc1/preview/7/IMG_0001.jpg', 'image/jpeg'],
			'a user who never opened honeycomb' => ['/bob/files/IMG_0001.jpg', 'image/jpeg'],
		];
	}

	// spec: IMAGES-001.17
	#[DataProvider('otherWrites')]
	public function testQueuesNothingForOtherWrites(string $path, ?string $mime): void {
		$this->listener()->handle(new NodeWrittenEvent($mime === null ? $this->folder($path) : $this->file($path, $mime)));

		$this->assertSame([], $this->queued);
	}

	private function folder(string $path): Folder {
		$folder = $this->createStub(Folder::class);
		$folder->method('getPath')->willReturn($path);
		return $folder;
	}

	// spec: IMAGES-001.17
	public function testIgnoresOtherEvents(): void {
		$this->listener()->handle(new Event());

		$this->assertSame([], $this->queued);
	}
}
