<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\BackgroundJob;

use OCA\Honeycomb\BackgroundJob\GeneratePreviews;
use OCA\Honeycomb\Service\ImageService;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\BackgroundJob\IJobList;
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

final class GeneratePreviewsTest extends TestCase {
	/** @var list<int> */
	private array $warmed = [];

	private function job(bool $userExists = true): GeneratePreviews {
		$alice = $this->createStub(IUser::class);
		$alice->method('getUID')->willReturn('alice');
		$users = $this->createStub(IUserManager::class);
		$users->method('get')->willReturnMap([['alice', $userExists ? $alice : null]]);
		$image = $this->createStub(File::class);
		$image->method('getId')->willReturn(7);
		$image->method('getMimetype')->willReturn('image/jpeg');
		$image->method('isReadable')->willReturn(true);
		$userFolder = $this->createStub(Folder::class);
		$userFolder->method('getFirstNodeById')->willReturnCallback(static fn (int $id): ?Node => $id === 7 ? $image : null);
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		$preview = $this->createStub(IPreview::class);
		$preview->method('generatePreviews')->willReturnCallback(function (File $file): ISimpleFile {
			$this->warmed[] = $file->getId();
			return $this->createStub(ISimpleFile::class);
		});
		$images = new ImageService($root, $preview, $this->createStub(IJobList::class), $this->createStub(LoggerInterface::class));
		return new GeneratePreviews($this->createStub(ITimeFactory::class), $users, $images);
	}

	private function runJob(GeneratePreviews $job, mixed $argument): void {
		(new \ReflectionMethod($job, 'run'))->invoke($job, $argument);
	}

	public function testWarmsTheQueuedFilesOfTheUser(): void {
		$this->runJob($this->job(), ['userId' => 'alice', 'fileIds' => [7, 8]]);

		$this->assertSame([7], $this->warmed);
	}

	public function testDoesNothingForAUserWhoIsGone(): void {
		$this->runJob($this->job(false), ['userId' => 'alice', 'fileIds' => [7]]);

		$this->assertSame([], $this->warmed);
	}

	/** @return array<string, array{mixed}> */
	public static function malformedArguments(): array {
		return [
			'no array' => ['alice'],
			'no user' => [['fileIds' => [7]]],
			'no file ids' => [['userId' => 'alice']],
			'a file id that is no number' => [['userId' => 'alice', 'fileIds' => ['7']]],
		];
	}

	#[DataProvider('malformedArguments')]
	public function testRejectsAMalformedArgument(mixed $argument): void {
		$this->expectException(\InvalidArgumentException::class);

		$this->runJob($this->job(), $argument);
	}
}
