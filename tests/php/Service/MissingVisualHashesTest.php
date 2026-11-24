<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FolderNotFoundException;
use OCA\Honeycomb\Service\FolderNotReadableException;
use OCA\Honeycomb\Service\InvalidRequestException;
use OCA\Honeycomb\Service\Reason;
use OCA\Honeycomb\Service\MissingVisualHashes;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\VisualHash;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class MissingVisualHashesTest extends TestCase {
	use FakeFiles;

	private const string HASH = '00ff00ff00ff00ff';
	private const int METHOD = 1;

	private FakeVisualHashStore $store;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeVisualHashStore();
	}

	private function service(IRootFolder $root, int $pageSize = MissingVisualHashes::PAGE_SIZE): MissingVisualHashes {
		return new MissingVisualHashes(new UserFolderResolver($root), $this->store, $pageSize);
	}

	/**
	 * @param array{pictures: list<array{path: string, ...}>, ...} $page
	 * @return list<string>
	 */
	private function paths(array $page): array {
		return array_column($page['pictures'], 'path');
	}

	private function photos(int $count): Folder {
		$files = [];
		for ($id = 1; $id <= $count; $id++) {
			$files[] = $this->file($id, sprintf('/Photos/%s/IMG_%04d.JPG', $id <= 3 ? '2023' : '2024', $id));
		}
		return $this->treeOf($files);
	}

	// spec: SERIES-004.1
	public function testListsThePhotosWithoutACurrentHashInNameOrderThroughTheTree(): void {
		$photos = $this->treeOf([
			$this->file(1, '/Photos/b.JPG'),
			$this->file(2, '/Photos/2024/a.JPG'),
			$this->file(3, '/Photos/2024/b.CR2', 'image/x-dcraw'),
			$this->file(4, '/Photos/2024/b.xmp', 'application/octet-stream'),
			$this->file(5, '/Photos/a.JPG'),
			$this->file(6, '/Photos/.hidden/c.JPG'),
			$this->file(7, '/Photos/c.JPG'),
			$this->file(8, '/Photos/d.JPG'),
		]);
		$this->store->rows = [
			5 => new VisualHash(5, 'etag-5', self::METHOD, self::HASH),
			7 => new VisualHash(7, 'older', self::METHOD, self::HASH),
			8 => new VisualHash(8, 'etag-8', self::METHOD + 1, self::HASH),
		];

		$page = $this->service($this->rootWith(['/Photos' => $photos]))->page($this->user(), 'Photos', '', self::METHOD);

		$this->assertSame(['/Photos/2024/a.JPG', '/Photos/2024/b.CR2', '/Photos/b.JPG', '/Photos/c.JPG', '/Photos/d.JPG'], $this->paths($page));
		$this->assertSame(['fileId' => 2, 'etag' => 'etag-2', 'mtime' => 1_700_000_002, 'path' => '/Photos/2024/a.JPG'], $page['pictures'][0]);
		$this->assertNull($page['nextCursor']);
	}

	// spec: SERIES-004.2, APP-004.3
	public function testAPageEndsWithTheCursorOfItsLastPhotoAndTheNextGoesOnAfterIt(): void {
		$service = $this->service($this->rootWith(['/Photos' => $this->photos(5)]), 2);

		$first = $service->page($this->user(), 'Photos', '', self::METHOD);
		$second = $service->page($this->user(), 'Photos', (string)$first['nextCursor'], self::METHOD);
		$listedBefore = count($this->listed);
		$third = $service->page($this->user(), 'Photos', (string)$second['nextCursor'], self::METHOD);

		$this->assertSame(['/Photos/2023/IMG_0001.JPG', '/Photos/2023/IMG_0002.JPG'], $this->paths($first));
		$this->assertSame('2023/IMG_0002.JPG', $first['nextCursor']);
		$this->assertSame(['/Photos/2023/IMG_0003.JPG', '/Photos/2024/IMG_0004.JPG'], $this->paths($second));
		$this->assertSame(['/Photos/2024/IMG_0005.JPG'], $this->paths($third));
		$this->assertNull($third['nextCursor']);
		$this->assertSame(['/Photos', '/Photos/2024'], array_slice($this->listed, $listedBefore));
	}

	// spec: SERIES-004.2, APP-004.3
	public function testAPageOfHashedPhotosIsEmptyButGoesOn(): void {
		$this->store->rows = [1 => new VisualHash(1, 'etag-1', 1, self::HASH), 2 => new VisualHash(2, 'etag-2', 1, self::HASH)];

		$page = $this->service($this->rootWith(['/Photos' => $this->photos(3)]), 2)->page($this->user(), 'Photos', '', self::METHOD);

		$this->assertSame([], $page['pictures']);
		$this->assertSame('2023/IMG_0002.JPG', $page['nextCursor']);
	}

	// spec: SERIES-004.2, APP-004.3
	public function testACursorWhoseFileVanishedGoesOnAfterItsName(): void {
		$page = $this->service($this->rootWith(['/Photos' => $this->photos(5)]))->page($this->user(), 'Photos', '2023/IMG_0002b.JPG', self::METHOD);

		$this->assertSame(['/Photos/2023/IMG_0003.JPG', '/Photos/2024/IMG_0004.JPG', '/Photos/2024/IMG_0005.JPG'], $this->paths($page));
	}

	// spec: SERIES-004.2, APP-004.3
	public function testLooksUpTheHashesOfAPageAtOnce(): void {
		$this->service($this->rootWith(['/Photos' => $this->photos(3)]))->page($this->user(), 'Photos', '', self::METHOD);

		$this->assertSame([[1, 2, 3]], $this->store->findCalls);
	}

	// spec: SERIES-004.3
	public function testSkipsFoldersOfAnotherMount(): void {
		$photos = $this->treeOf([
			$this->file(1, '/Photos/own.JPG'),
			$this->file(2, '/Photos/From Bob/a.JPG'),
			$this->file(3, '/Photos/Team/b.JPG'),
		], mountTypes: ['/Photos/From Bob' => 'shared', '/Photos/Team' => 'group']);

		$page = $this->service($this->rootWith(['/Photos' => $photos]))->page($this->user(), 'Photos', '', self::METHOD);

		$this->assertSame(['/Photos/own.JPG'], $this->paths($page));
	}

	// spec: SERIES-004.3
	public function testAChosenShareListsNothing(): void {
		$shared = $this->treeOf([$this->file(1, '/From Bob/a.JPG')], '/From Bob', mountTypes: ['/From Bob' => 'shared']);

		$page = $this->service($this->rootWith(['/From Bob' => $shared]))->page($this->user(), 'From Bob', '', self::METHOD);

		$this->assertSame(['pictures' => [], 'nextCursor' => null], $page);
	}

	// spec: SERIES-004.1
	public function testSkipsUnreadableFolders(): void {
		$photos = $this->treeOf([$this->file(1, '/Photos/a.JPG'), $this->file(2, '/Photos/Locked/b.JPG')], unreadable: ['/Photos/Locked']);

		$page = $this->service($this->rootWith(['/Photos' => $photos]))->page($this->user(), 'Photos', '', self::METHOD);

		$this->assertSame(['/Photos/a.JPG'], $this->paths($page));
	}

	// spec: SERIES-004.4
	public function testAPathThatIsNoFolderOfTheUserIsNotFound(): void {
		$this->expectException(FolderNotFoundException::class);

		$this->service($this->rootWith([]))->page($this->user(), 'Nowhere', '', self::METHOD);
	}

	// spec: SERIES-004.4
	public function testAnUnreadableFolderIsRefused(): void {
		$this->expectException(FolderNotReadableException::class);

		$this->service($this->rootWith(['/Locked' => $this->folder('/Locked', false)]))->page($this->user(), 'Locked', '', self::METHOD);
	}

	/** @return array<string, array{int}> */
	public static function badMethods(): array {
		return ['zero' => [0], 'negative' => [-1], 'beyond a small integer' => [256]];
	}

	// spec: SERIES-004.4
	#[DataProvider('badMethods')]
	public function testAMethodOutsideOneTo255IsRefused(int $method): void {
		$this->expectException(InvalidRequestException::class);

		$this->service($this->rootWith(['/Photos' => $this->photos(1)]))->page($this->user(), 'Photos', '', $method);
	}

	/** @return array<string, array{string}> */
	public static function badCursors(): array {
		return ['absolute' => ['/2024/a.JPG'], 'climbing' => ['2024/../../a.JPG'], 'empty segment' => ['2024//a.JPG'], 'dot' => ['./a.JPG']];
	}

	// spec: SERIES-004.4
	#[DataProvider('badCursors')]
	public function testACursorThatIsNoRelativePathIsRefused(string $cursor): void {
		$this->assertSame(Reason::BadCursor, ReasonOf::call(fn () => $this->service($this->rootWith(['/Photos' => $this->photos(1)]))->page($this->user(), 'Photos', $cursor, self::METHOD)));
	}
}
