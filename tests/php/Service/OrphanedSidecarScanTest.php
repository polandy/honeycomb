<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FolderNotFoundException;
use OCA\Honeycomb\Service\InvalidCursorException;
use OCA\Honeycomb\Service\OrphanedSidecarScan;
use OCA\Honeycomb\Service\UserFolderResolver;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class OrphanedSidecarScanTest extends TestCase {
	use FakeTree;

	private function scan(int $pageSize = OrphanedSidecarScan::PAGE_SIZE): OrphanedSidecarScan {
		return new OrphanedSidecarScan(new UserFolderResolver($this->treeRoot()), $pageSize);
	}

	/**
	 * @param array{sidecars: list<array{path: string, ...}>, ...} $page
	 * @return list<string>
	 */
	private static function paths(array $page): array {
		return array_column($page['sidecars'], 'path');
	}

	// spec: XMP-009.1
	public function testListsOnlyTheSidecarsWithoutAMediaFileOfEitherForm(): void {
		$this->addFiles([
			1 => '/P/A.CR2', 2 => '/P/A.CR2.xmp',
			3 => '/P/B.JPG', 4 => '/P/b.xmp',
			5 => '/P/C.MOV', 6 => '/P/C.MOV.XMP',
			7 => '/P/D.NEF', 8 => '/P/D_01.NEF.xmp',
			9 => '/P/E.CR2.xmp', 10 => '/P/F.xmp',
		]);

		$this->assertSame(['/P/E.CR2.xmp', '/P/F.xmp'], self::paths($this->scan()->page($this->treeUser(), '/P', '')));
	}

	// spec: XMP-009.2
	public function testAMediaFileInAnotherFolderOrAFileOfAnotherTypeKeepsNoSidecar(): void {
		$this->addFiles([1 => '/Photos/A.xmp', 2 => '/Photos/2024/A.JPG', 3 => '/Photos/G.xmp', 4 => '/Photos/G.txt']);

		$this->assertSame(['/Photos/A.xmp', '/Photos/G.xmp'], self::paths($this->scan()->page($this->treeUser(), '/Photos', '')));
	}

	// spec: XMP-009.3
	public function testWalksTheOwnVisibleReadableFoldersInNameOrderAndDeletesNothing(): void {
		$this->addFiles([
			1 => '/Photos/b.xmp',
			2 => '/Photos/2024/x.xmp',
			3 => '/Photos/2023/y.xmp',
			4 => '/Photos/.hidden/z.xmp',
			5 => '/Photos/locked/z.xmp',
			6 => '/Photos/shared/z.xmp',
			7 => '/Photos/a.xmp',
		]);
		$this->unreadable['/Photos/locked'] = true;
		$this->mounts['/Photos/shared'] = true;

		$page = $this->scan()->page($this->treeUser(), 'Photos', '');

		$this->assertSame(['/Photos/a.xmp', '/Photos/b.xmp', '/Photos/2023/y.xmp', '/Photos/2024/x.xmp'], self::paths($page));
		$this->assertSame(['fileId' => 7, 'etag' => 'etag-7', 'path' => '/Photos/a.xmp', 'size' => 700], $page['sidecars'][0]);
		$this->assertNull($page['nextCursor']);
		$this->assertSame([], $this->trashed);
	}

	// spec: XMP-009.4
	public function testAPageEndsAfterAWholeFolderAndTheNextGoesOnAfterIt(): void {
		$this->addFiles([
			1 => '/P/a.xmp', 2 => '/P/b.xmp',
			3 => '/P/2023/c.xmp',
			4 => '/P/2024/d.xmp', 5 => '/P/2024/e.JPG',
			6 => '/P/2024/sub/f.xmp',
		]);
		$scan = $this->scan(2);

		$first = $scan->page($this->treeUser(), '/P', '');
		$second = $scan->page($this->treeUser(), '/P', (string)$first['nextCursor']);
		$third = $scan->page($this->treeUser(), '/P', (string)$second['nextCursor']);

		$this->assertSame([['/P/a.xmp', '/P/b.xmp'], '/'], [self::paths($first), $first['nextCursor']]);
		$this->assertSame([['/P/2023/c.xmp', '/P/2024/d.xmp'], '/2024'], [self::paths($second), $second['nextCursor']]);
		$this->assertSame([['/P/2024/sub/f.xmp'], null], [self::paths($third), $third['nextCursor']]);
	}

	// spec: XMP-009.3
	public function testTheWholeLibraryIsTheUsersFolder(): void {
		$this->addFiles([1 => '/a.xmp', 2 => '/Photos/b.xmp']);

		$this->assertSame(['/a.xmp', '/Photos/b.xmp'], self::paths($this->scan()->page($this->treeUser(), '/', '')));
	}

	// spec: XMP-009.5
	public function testRefusesAPathThatIsNoFolderOfTheUser(): void {
		$this->addFiles([1 => '/P/a.xmp']);

		$this->expectException(FolderNotFoundException::class);
		$this->scan()->page($this->treeUser(), '/P/a.xmp', '');
	}

	/** @return array<string, array{string}> */
	public static function badCursors(): array {
		return ['no leading slash' => ['2024'], 'empty segment' => ['/2024//a'], 'dot' => ['/.'], 'dot dot' => ['/../x'], 'trailing slash' => ['/2024/']];
	}

	// spec: XMP-009.5
	#[DataProvider('badCursors')]
	public function testRefusesACursorThatIsNoFolderPath(string $cursor): void {
		$this->addFiles([1 => '/P/a.xmp']);

		$this->expectException(InvalidCursorException::class);
		$this->scan()->page($this->treeUser(), '/P', $cursor);
	}
}
