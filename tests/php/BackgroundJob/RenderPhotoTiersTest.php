<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\BackgroundJob;

use OCA\Honeycomb\BackgroundJob\RenderPhotoTiers;
use OCA\Honeycomb\Service\ImageService;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\Files\SimpleFS\ISimpleFile;
use OCP\IPreview;
use OCP\IUser;
use OCP\IUserManager;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class RenderPhotoTiersTest extends TestCase {
	/** @var array<int, list<int>> the tiers rendered, by file id */
	private array $rendered = [];

	private function job(?LoggerInterface $logger = null): RenderPhotoTiers {
		$photo = $this->createStub(File::class);
		$photo->method('getId')->willReturn(7);
		$photo->method('getName')->willReturn('IMG_0001.jpg');
		$photo->method('getMimetype')->willReturn('image/jpeg');
		$photo->method('isReadable')->willReturn(true);
		$userFolder = $this->createStub(Folder::class);
		$userFolder->method('getFirstNodeById')->willReturnCallback(static fn (int $id): ?Node => $id === 7 ? $photo : null);
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		$preview = $this->createStub(IPreview::class);
		$preview->method('generatePreviews')->willReturnCallback(function (File $file, array $specifications): ISimpleFile {
			$this->rendered[$file->getId()] = array_map(static fn (array $specification): int => $specification['width'], $specifications);
			return $this->createStub(ISimpleFile::class);
		});
		$alice = $this->createStub(IUser::class);
		$alice->method('getUID')->willReturn('alice');
		$users = $this->createStub(IUserManager::class);
		$users->method('get')->willReturnCallback(static fn (string $userId): ?IUser => $userId === 'alice' ? $alice : null);
		$logger ??= $this->createStub(LoggerInterface::class);
		$images = new ImageService(new UserPhotos(new UserFolderResolver($root)), $preview, $logger);
		return new RenderPhotoTiers($this->createStub(ITimeFactory::class), $users, $images, $logger);
	}

	private function execute(RenderPhotoTiers $job, mixed $argument): void {
		(new \ReflectionMethod($job, 'run'))->invoke($job, $argument);
	}

	// spec: IMAGES-001.16
	public function testRendersTheThreeTiersOfTheFile(): void {
		$this->execute($this->job(), ['userId' => 'alice', 'fileId' => 7]);

		$this->assertSame([7 => ImageService::TIERS], $this->rendered);
	}

	// spec: IMAGES-001.17
	public function testRendersNothingWhenTheUserOrTheFileIsGone(): void {
		$job = $this->job();

		$this->execute($job, ['userId' => 'carol', 'fileId' => 7]);
		$this->execute($job, ['userId' => 'alice', 'fileId' => 8]);

		$this->assertSame([], $this->rendered);
	}

	/** @return array<string, array{mixed}> */
	public static function malformedArguments(): array {
		return [
			'none' => [null],
			'no file id' => [['userId' => 'alice']],
			'a file id as a string' => [['userId' => 'alice', 'fileId' => '7']],
		];
	}

	// spec: IMAGES-001.17
	#[DataProvider('malformedArguments')]
	public function testLogsAMalformedArgumentAndRendersNothing(mixed $argument): void {
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('warning');

		$this->execute($this->job($logger), $argument);

		$this->assertSame([], $this->rendered);
	}
}
