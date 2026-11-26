<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Listener;

use OCA\Honeycomb\Listener\WriteRawExif;
use OCA\Honeycomb\Service\App\AppVisits;
use OCA\Honeycomb\Service\Listing\RawExif;
use OCA\Honeycomb\Service\Listing\RawExifReader;
use OCA\Honeycomb\Service\Listing\RawHeaderParser;
use OCA\Honeycomb\Service\Listing\TiffFields;
use OCA\Honeycomb\Service\Settings\SettingsService;
use OCA\Honeycomb\Tests\Service\Listing\RawBytes;
use OCP\Config\IUserConfig;
use OCP\EventDispatcher\Event;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\Node;
use OCP\Files\NotPermittedException;
use OCP\Files\Storage\IStorage;
use OCP\FilesMetadata\Event\MetadataBackgroundEvent;
use OCP\FilesMetadata\Event\MetadataLiveEvent;
use OCP\FilesMetadata\Model\IFilesMetadata;
use OCP\IUser;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class WriteRawExifTest extends TestCase {
	/** @var array<string, array<array-key, mixed>> the arrays written to the metadata, by key */
	private array $written = [];
	/** @var list<string> the warnings logged */
	private array $warnings = [];

	/** @param string $settings alice's stored settings */
	private function listener(string $settings = '{}'): WriteRawExif {
		$config = $this->createStub(IUserConfig::class);
		$config->method('getValueBool')->willReturnCallback(static fn (string $userId): bool => $userId === 'alice');
		$config->method('getValueString')->willReturnCallback(static fn (string $userId, string $app, string $key, string $default = ''): string => $key === 'settings' ? $settings : $default);
		$logger = $this->createStub(LoggerInterface::class);
		$logger->method('warning')->willReturnCallback(function (string $message): void {
			$this->warnings[] = $message;
		});
		return new WriteRawExif(new AppVisits($config), new SettingsService($config), new RawExifReader(new RawHeaderParser(new TiffFields()), $logger));
	}

	private function metadata(): IFilesMetadata {
		$metadata = $this->createStub(IFilesMetadata::class);
		$metadata->method('setArray')->willReturnCallback(function (string $key, array $value) use ($metadata): IFilesMetadata {
			$this->written[$key] = $value;
			return $metadata;
		});
		return $metadata;
	}

	private function owner(?string $userId): ?IUser {
		if ($userId === null) {
			return null;
		}
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn($userId);
		return $user;
	}

	private function file(string $name, string $bytes = '', ?string $owner = 'alice', bool $local = true, bool $readable = true): File {
		$storage = $this->createStub(IStorage::class);
		$storage->method('isLocal')->willReturn($local);
		$file = $this->createStub(File::class);
		$file->method('getName')->willReturn($name);
		$file->method('getOwner')->willReturn($this->owner($owner));
		$file->method('getStorage')->willReturn($storage);
		if (!$readable) {
			$file->method('fopen')->willThrowException(new NotPermittedException('no'));
			return $file;
		}
		$stream = fopen('php://memory', 'w+b');
		$this->assertNotFalse($stream);
		fwrite($stream, $bytes);
		rewind($stream);
		$file->method('fopen')->willReturn($stream);
		return $file;
	}

	private static function nef(): string {
		return RawBytes::tiff(['Make' => 'NIKON CORPORATION', 'Model' => 'NIKON Z 6_2'], ['DateTimeOriginal' => '2026:11:25 14:03:09', 'OffsetTimeOriginal' => '+00:00']);
	}

	/** @return array<string, array{class-string<MetadataLiveEvent|MetadataBackgroundEvent>}> */
	public static function events(): array {
		return ['live' => [MetadataLiveEvent::class], 'background' => [MetadataBackgroundEvent::class]];
	}

	/** @param class-string<MetadataLiveEvent|MetadataBackgroundEvent> $event */
	// spec: LISTING-004.8
	#[DataProvider('events')]
	public function testWritesTheValueOfARawFileOfAUserWhoOpenedHoneycomb(string $event): void {
		$this->listener()->handle(new $event($this->file('DSC_0001.NEF', self::nef()), $this->metadata()));

		$this->assertSame([RawExif::KEY => ['DateTimeOriginal' => 1_795_615_389, 'Make' => 'NIKON CORPORATION', 'Model' => 'NIKON Z 6_2']], $this->written);
	}

	// spec: LISTING-004.6
	public function testWritesAnEmptyValueForARawExtensionOfAFormatItDoesNotRead(): void {
		$this->listener('{"rawExtensions":["x3f"]}')->handle(new MetadataLiveEvent($this->file('IMG_0001.x3f', 'FOVb'), $this->metadata()));

		$this->assertSame([RawExif::KEY => []], $this->written);
	}

	/** @return array<string, array{Node, string}> the node and alice's stored settings of each event that reads nothing */
	public function otherFiles(): array {
		$folder = $this->createStub(Folder::class);
		$folder->method('getOwner')->willReturn($this->owner('alice'));
		return [
			'a folder' => [$folder, '{}'],
			'a rendered file' => [$this->file('DSC_0001.JPG', self::nef()), '{}'],
			'a sidecar' => [$this->file('DSC_0001.NEF.xmp', self::nef()), '{}'],
			'an extension the owner removed' => [$this->file('DSC_0001.NEF', self::nef()), '{"rawExtensions":["cr3"]}'],
			'a user who never opened honeycomb' => [$this->file('DSC_0001.NEF', self::nef(), 'bob'), '{}'],
			'no owner' => [$this->file('DSC_0001.NEF', self::nef(), null), '{}'],
		];
	}

	// spec: LISTING-004.8
	public function testReadsNothingForOtherFiles(): void {
		foreach ($this->otherFiles() as $case => [$node, $settings]) {
			$this->listener($settings)->handle(new MetadataBackgroundEvent($node, $this->metadata()));
			$this->assertSame([], $this->written, $case);
		}
		$this->listener()->handle(new Event());
		$this->assertSame([], $this->written);
	}

	// spec: LISTING-004.9
	public function testAsksForTheBackgroundJobOnAStorageThatIsNotLocal(): void {
		$live = new MetadataLiveEvent($this->file('DSC_0001.NEF', self::nef(), local: false), $this->metadata());
		$this->listener()->handle($live);

		$this->assertTrue($live->isRunAsBackgroundJobRequested());
		$this->assertSame([], $this->written);

		$this->listener()->handle(new MetadataBackgroundEvent($this->file('DSC_0001.NEF', self::nef(), local: false), $this->metadata()));
		$this->assertSame(['NIKON CORPORATION'], array_column($this->written, 'Make'));
	}

	// spec: LISTING-004.9
	public function testReadsAtOnceOnALocalStorage(): void {
		$live = new MetadataLiveEvent($this->file('DSC_0001.NEF', self::nef()), $this->metadata());
		$this->listener()->handle($live);

		$this->assertFalse($live->isRunAsBackgroundJobRequested());
		$this->assertArrayHasKey(RawExif::KEY, $this->written);
	}

	// spec: LISTING-004.10
	public function testWritesNoKeyForAFileThatCannotBeRead(): void {
		$this->listener()->handle(new MetadataLiveEvent($this->file('DSC_0001.NEF', readable: false), $this->metadata()));

		$this->assertSame([], $this->written);
		$this->assertSame(['Could not open the RAW file {fileId} to read its header'], $this->warnings);
	}
}
