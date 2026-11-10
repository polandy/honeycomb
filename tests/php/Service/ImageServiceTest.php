<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\BackgroundJob\GeneratePreviews;
use OCA\Honeycomb\Service\ImageNotFoundException;
use OCA\Honeycomb\Service\ImageNotReadableException;
use OCA\Honeycomb\Service\ImageService;
use OCP\BackgroundJob\IJobList;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\Files\NotFoundException;
use OCP\Files\SimpleFS\ISimpleFile;
use OCP\IPreview;
use OCP\IUser;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class ImageServiceTest extends TestCase {
	private function user(): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		return $user;
	}

	private function image(int $id, string $mime = 'image/jpeg', bool $readable = true): File {
		$file = $this->createStub(File::class);
		$file->method('getId')->willReturn($id);
		$file->method('getMimetype')->willReturn($mime);
		$file->method('isReadable')->willReturn($readable);
		return $file;
	}

	/** @param array<int, Node> $nodes alice's nodes by file id */
	private function service(array $nodes, ?IPreview $preview = null, ?IJobList $jobList = null, ?LoggerInterface $logger = null): ImageService {
		$userFolder = $this->createStub(Folder::class);
		$userFolder->method('getFirstNodeById')->willReturnCallback(static fn (int $id): ?Node => $nodes[$id] ?? null);
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		return new ImageService(
			$root,
			$preview ?? $this->createStub(IPreview::class),
			$jobList ?? $this->createStub(IJobList::class),
			$logger ?? $this->createStub(LoggerInterface::class),
		);
	}

	public function testFindsAnImageInTheUsersFiles(): void {
		$raw = $this->image(7, 'image/x-dcraw');

		$this->assertSame($raw, $this->service([7 => $raw])->find($this->user(), 7));
	}

	public function testAnIdOutsideTheUsersFilesIsNotFound(): void {
		$this->expectException(ImageNotFoundException::class);

		$this->service([])->find($this->user(), 7);
	}

	public function testAFolderIsNotFound(): void {
		$this->expectException(ImageNotFoundException::class);

		$this->service([7 => $this->createStub(Folder::class)])->find($this->user(), 7);
	}

	public function testAFileThatIsNoImageIsNotFound(): void {
		$this->expectException(ImageNotFoundException::class);

		$this->service([7 => $this->image(7, 'application/pdf')])->find($this->user(), 7);
	}

	public function testAnUnreadableImageIsNotReadable(): void {
		$this->expectException(ImageNotReadableException::class);

		$this->service([7 => $this->image(7, readable: false)])->find($this->user(), 7);
	}

	public function testRendersATierAsTheLongEdgeWithoutCropping(): void {
		$file = $this->image(7);
		$rendered = $this->createStub(ISimpleFile::class);
		$preview = $this->createMock(IPreview::class);
		$preview->expects($this->once())->method('getPreview')->with($file, 512, 512, false, IPreview::MODE_FILL)->willReturn($rendered);

		$this->assertSame($rendered, $this->service([], $preview)->preview($file, 512));
	}

	/** @return array<string, array{\Throwable}> */
	public static function previewFailures(): array {
		return [
			'no provider' => [new NotFoundException()],
			'an invalid image' => [new \InvalidArgumentException()],
		];
	}

	#[DataProvider('previewFailures')]
	public function testAnImageWithoutAPreviewIsNotFound(\Throwable $failure): void {
		$preview = $this->createStub(IPreview::class);
		$preview->method('getPreview')->willThrowException($failure);

		$this->expectException(ImageNotFoundException::class);

		$this->service([], $preview)->preview($this->image(7), 256);
	}

	public function testTheFullImageOfAFileTheBrowserShowsIsTheFileItself(): void {
		$file = $this->image(7);
		$preview = $this->createMock(IPreview::class);
		$preview->expects($this->never())->method('getPreview');

		$this->assertSame($file, $this->service([], $preview)->full($file));
	}

	public function testTheFullImageOfARawIsItsLargestPreview(): void {
		$file = $this->image(7, 'image/x-dcraw');
		$rendered = $this->createStub(ISimpleFile::class);
		$preview = $this->createMock(IPreview::class);
		$preview->expects($this->once())->method('getPreview')->with($file, -1, -1, false)->willReturn($rendered);

		$this->assertSame($rendered, $this->service([], $preview)->full($file));
	}

	#[DataProvider('previewFailures')]
	public function testARawWithoutAPreviewHasNoFullImage(\Throwable $failure): void {
		$preview = $this->createStub(IPreview::class);
		$preview->method('getPreview')->willThrowException($failure);

		$this->expectException(ImageNotFoundException::class);

		$this->service([], $preview)->full($this->image(7, 'image/heic'));
	}

	public function testWarmsEveryTierOfEachImageAndSkipsWhatItCannotRender(): void {
		$first = $this->image(1);
		$broken = $this->image(2);
		$last = $this->image(4, 'image/x-dcraw');
		$warmed = [];
		$preview = $this->createStub(IPreview::class);
		$preview->method('generatePreviews')->willReturnCallback(function (File $file, array $specifications) use ($broken, &$warmed): ISimpleFile {
			if ($file === $broken) {
				throw new NotFoundException();
			}
			$warmed[$file->getId()] = $specifications;
			return $this->createStub(ISimpleFile::class);
		});
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->exactly(3))->method('debug');

		$nodes = [1 => $first, 2 => $broken, 3 => $this->image(3, readable: false), 4 => $last];
		$this->service($nodes, $preview, logger: $logger)->warm($this->user(), [1, 2, 3, 5, 4]);

		$tiers = array_map(static fn (int $size): array => ['width' => $size, 'height' => $size, 'crop' => false, 'mode' => IPreview::MODE_FILL], [256, 512, 2048]);
		$this->assertSame([1 => $tiers, 4 => $tiers], $warmed);
	}

	public function testQueuesWarmingInJobsOfAtMostTwoHundredFiles(): void {
		$ids = range(1, 450);
		$queued = [];
		$jobList = $this->createStub(IJobList::class);
		$jobList->method('add')->willReturnCallback(static function (string $job, mixed $argument) use (&$queued): void {
			$queued[] = [$job, $argument];
		});

		$this->service([], jobList: $jobList)->queueWarm($this->user(), $ids);

		$this->assertSame([
			[GeneratePreviews::class, ['userId' => 'alice', 'fileIds' => range(1, 200)]],
			[GeneratePreviews::class, ['userId' => 'alice', 'fileIds' => range(201, 400)]],
			[GeneratePreviews::class, ['userId' => 'alice', 'fileIds' => range(401, 450)]],
		], $queued);
	}
}
