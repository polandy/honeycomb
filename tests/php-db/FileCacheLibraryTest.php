<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\FileCacheLibrary;
use OCA\Honeycomb\Db\FlagMapper;
use OCA\Honeycomb\Service\FileFlag;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\LibraryFolder;
use OCA\Honeycomb\Service\SeriesStatus;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\Files\Folder;
use OCP\Files\IMimeTypeLoader;
use OCP\Files\IRootFolder;
use OCP\IUserManager;
use OCP\Server;

/** The library folders, their photo files and the decision rows, read from Nextcloud's file cache of a real user's files. */
final class FileCacheLibraryTest extends DbTestCase {
	private const string USER = 'honeycomb-library';
	private const string PASSWORD = 'honeycomb-library-Passw0rd-long!';

	private IUserManager $users;
	private Folder $home;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->users = Server::get(IUserManager::class);
		$this->users->get(self::USER)?->delete();
		$this->users->createUser(self::USER, self::PASSWORD);
		$this->home = Server::get(IRootFolder::class)->getUserFolder(self::USER);
	}

	#[\Override]
	protected function tearDown(): void {
		$this->users->get(self::USER)?->delete();
		parent::tearDown();
	}

	private function library(): FileCacheLibrary {
		return new FileCacheLibrary($this->db, Server::get(IMimeTypeLoader::class));
	}

	/**
	 * Creates the files at `$paths` with their folders and answers their file ids by path.
	 * @param list<string> $paths
	 * @return array<string, int>
	 */
	private function files(array $paths): array {
		$ids = [];
		foreach ($paths as $path) {
			$ids[$path] = $this->folderAt(dirname($path))->newFile(basename($path), str_repeat('x', strlen($path)))->getId();
		}
		return $ids;
	}

	private function folderAt(string $path): Folder {
		$folder = $this->home;
		foreach (array_filter(explode('/', $path), static fn (string $name): bool => $name !== '' && $name !== '.') as $name) {
			$next = $folder->nodeExists($name) ? $folder->get($name) : $folder->newFolder($name);
			assert($next instanceof Folder);
			$folder = $next;
		}
		return $folder;
	}

	private function series(string $userId, SeriesStatus $status, int ...$fileIds): void {
		$series = $this->db->getQueryBuilder();
		$series->insert('honeycomb_series')->values(['user_id' => $series->createNamedParameter($userId), 'status' => $series->createNamedParameter($status->value)])->executeStatement();
		$seriesId = $series->getLastInsertId();
		foreach ($fileIds as $fileId) {
			$member = $this->db->getQueryBuilder();
			$member->insert('honeycomb_series_files')->values([
				'user_id' => $member->createNamedParameter($userId),
				'file_id' => $member->createNamedParameter($fileId, IQueryBuilder::PARAM_INT),
				'series_id' => $member->createNamedParameter($seriesId, IQueryBuilder::PARAM_INT),
			])->executeStatement();
		}
	}

	// spec: FOLDERS-001.1, FOLDERS-001.12
	public function testListsTheRootAndItsFoldersWithoutHiddenOnesInPathOrder(): void {
		$this->files(['Photos/a.jpg', 'Photos/2024/Trip/b.jpg', 'Photos/2023/c.jpg', 'Photos/.hidden/d.jpg', 'Photos/.hidden/Below/e.jpg', 'Other/f.jpg']);
		$root = $this->folderAt('Photos');

		$folders = $this->library()->folders($root);

		$this->assertSame(['', '/2023', '/2024', '/2024/Trip'], array_map(static fn (LibraryFolder $folder): string => $folder->path, $folders));
		$this->assertEquals(new LibraryFolder($root->getId(), '', $root->getEtag(), $root->getPermissions()), $folders[0]);
		$this->assertSame($this->folderAt('Photos/2024/Trip')->getEtag(), $folders[3]->etag);
	}

	// spec: FOLDERS-001.1
	public function testAnswersTheOwnPhotoFilesOfTheFoldersGiven(): void {
		$ids = $this->files(['Photos/a.jpg', 'Photos/a.CR3', 'Photos/notes.txt', 'Photos/.b.jpg', 'Photos/c.xmp', 'Photos/2024/d.png', 'Other/e.jpg']);
		$photos = $this->folderAt('Photos');

		$files = $this->library()->photoFiles([$photos->getId()]);

		usort($files, static fn (array $a, array $b): int => $a['fileId'] <=> $b['fileId']);
		$this->assertSame([$ids['Photos/a.jpg'], $ids['Photos/a.CR3']], array_column($files, 'fileId'));
		$this->assertSame(['fileId' => $ids['Photos/a.jpg'], 'parent' => $photos->getId(), 'name' => 'a.jpg', 'size' => strlen('Photos/a.jpg')], array_diff_key($files[0], ['mtime' => true]));
	}

	// spec: FOLDERS-001.9
	public function testAnswersTheFlagAndDoneSeriesRowsOfTheUser(): void {
		$ids = $this->files(['Photos/a.jpg', 'Photos/a.nef', 'Photos/b.jpg', 'Photos/c.jpg', 'Photos/d.jpg', 'Photos/e.jpg', 'Photos/2024/f.jpg']);
		(new FlagMapper($this->db))->save([
			new FileFlag($ids['Photos/a.jpg'], Flag::Picked, false, 20),
			new FileFlag($ids['Photos/a.nef'], Flag::Rejected, false, 10),
			new FileFlag($ids['Photos/2024/f.jpg'], Flag::Picked, false, 5),
		]);
		$this->series(self::USER, SeriesStatus::Done, $ids['Photos/b.jpg'], $ids['Photos/a.jpg']);
		$this->series(self::USER, SeriesStatus::Open, $ids['Photos/c.jpg']);
		$this->series('someone-else', SeriesStatus::Done, $ids['Photos/d.jpg']);
		$photos = $this->folderAt('Photos')->getId();

		$rows = $this->library()->decisionRows(self::USER, [$photos]);

		usort($rows, static fn (array $a, array $b): int => strcmp($a['name'], $b['name']));
		$this->assertSame([
			['parent' => $photos, 'name' => 'a.jpg', 'flag' => 'picked', 'updatedAt' => 20, 'doneSeries' => true],
			['parent' => $photos, 'name' => 'a.nef', 'flag' => 'rejected', 'updatedAt' => 10, 'doneSeries' => false],
			['parent' => $photos, 'name' => 'b.jpg', 'flag' => null, 'updatedAt' => null, 'doneSeries' => true],
		], $rows);
	}
}
