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
use OCA\Honeycomb\Service\LibraryFolderService;
use OCP\Constants;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\Files\Folder;
use OCP\Files\IMimeTypeLoader;
use OCP\Files\IRootFolder;
use OCP\IUser;
use OCP\IUserManager;
use OCP\Server;
use PHPUnit\Framework\Attributes\Group;

/** Measures, without a time limit, the scan and the list of a large library (ADR 0049); `scripts/php-db-tests.sh --group bench` runs it. */
#[Group('bench')]
final class LibraryFolderBenchTest extends DbTestCase {
	private const string USER = 'honeycomb-bench';
	private const string PASSWORD = 'honeycomb-bench-Passw0rd-long!';
	private const int FOLDERS = 600;
	private const int PHOTOS_PER_FOLDER = 100;
	/** Every third photo carries a flag. */
	private const int FLAG_EVERY = 3;
	private const int PHOTO_BYTES = 3_000_000;
	private const int MTIME = 1_700_000_000;

	private IUserManager $users;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->users = Server::get(IUserManager::class);
		$this->users->get(self::USER)?->delete();
		$this->users->createUser(self::USER, self::PASSWORD);
	}

	#[\Override]
	protected function tearDown(): void {
		$this->users->get(self::USER)?->delete();
		parent::tearDown();
	}

	public function testMeasuresTheScanAndTheListOfSixtyThousandPhotos(): void {
		$user = $this->users->get(self::USER);
		assert($user instanceof IUser);
		$root = Server::get(IRootFolder::class)->getUserFolder(self::USER)->newFolder('Photos');
		$fileIds = $this->fill($root);
		(new FlagMapper($this->db))->save(array_map(static fn (int $fileId): FileFlag => new FileFlag($fileId, Flag::Picked, false, 1), array_values(array_filter($fileIds, static fn (int $index): bool => $index % self::FLAG_EVERY === 0, ARRAY_FILTER_USE_KEY))));
		$library = Server::get(LibraryFolderService::class);

		[$scans, $scanSeconds] = self::timed(static function () use ($library, $user): int {
			$calls = 0;
			do {
				$calls++;
				$scanning = $library->scan($user, '/Photos')['scanning'];
			} while ($scanning['done'] < $scanning['total']);
			return $calls;
		});
		[[$folders, $pages], $listSeconds] = self::timed(static function () use ($library, $user): array {
			$listed = [0, 0];
			$after = '';
			do {
				$page = $library->list($user, '/Photos', $after, '');
				$listed = [$listed[0] + count($page['folders']), $listed[1] + 1];
				$after = (string)$page['next'];
			} while ($page['next'] !== null);
			return $listed;
		});
		$cache = new FileCacheLibrary($this->db, Server::get(IMimeTypeLoader::class));
		$pageIds = array_slice(array_map(static fn (LibraryFolder $folder): int => $folder->fileId, $cache->folders($root)), 0, LibraryFolderService::MAX_LIMIT);
		[, $liveSeconds] = self::timed(static fn (): int => count($cache->decisionRows(self::USER, $pageIds)));

		fwrite(STDERR, sprintf("\n%s: %d scans %.3f s, list of %d folders in %d pages %.3f s, live query of one page %.3f s\n", $this->db->getDatabaseProvider(), $scans, $scanSeconds, $folders, $pages, $listSeconds, $liveSeconds));
		$this->assertSame(self::FOLDERS, $folders);
	}

	/**
	 * @template T
	 * @param callable(): T $run
	 * @return array{T, float}
	 */
	private static function timed(callable $run): array {
		$start = hrtime(true);
		$result = $run();
		return [$result, (hrtime(true) - $start) / 1e9];
	}

	/**
	 * Writes the folders and photo pairs straight into the file cache, as a scan of the storage would.
	 * @return list<int> the photo file ids
	 */
	private function fill(Folder $root): array {
		$location = $this->db->getQueryBuilder();
		$location->select('storage', 'path')->from('filecache')->where($location->expr()->eq('fileid', $location->createNamedParameter($root->getId(), IQueryBuilder::PARAM_INT)));
		$row = $location->executeQuery()->fetch();
		assert(is_array($row));
		$mimeTypes = Server::get(IMimeTypeLoader::class);
		$folderType = [$mimeTypes->getId('httpd/unix-directory'), $mimeTypes->getId('httpd')];
		$jpeg = [$mimeTypes->getId('image/jpeg'), $mimeTypes->getId('image')];
		$fileIds = [];
		$this->db->beginTransaction();
		for ($folder = 0; $folder < self::FOLDERS; $folder++) {
			$path = sprintf('%s/%04d', (string)$row['path'], $folder);
			$folderId = $this->insertEntry((int)$row['storage'], $path, $root->getId(), $folderType, 0);
			for ($photo = 0; $photo < self::PHOTOS_PER_FOLDER; $photo++) {
				$fileIds[] = $this->insertEntry((int)$row['storage'], sprintf('%s/IMG_%04d.jpg', $path, $photo), $folderId, $jpeg, self::PHOTO_BYTES);
			}
		}
		$this->db->commit();
		return $fileIds;
	}

	/** @param array{int, int} $mimetype the type and its part */
	private function insertEntry(int $storage, string $path, int $parent, array $mimetype, int $size): int {
		$insert = $this->db->getQueryBuilder();
		$insert->insert('filecache')->values([
			'storage' => $insert->createNamedParameter($storage, IQueryBuilder::PARAM_INT),
			'path' => $insert->createNamedParameter($path),
			'path_hash' => $insert->createNamedParameter(md5($path)),
			'parent' => $insert->createNamedParameter($parent, IQueryBuilder::PARAM_INT),
			'name' => $insert->createNamedParameter(basename($path)),
			'mimetype' => $insert->createNamedParameter($mimetype[0], IQueryBuilder::PARAM_INT),
			'mimepart' => $insert->createNamedParameter($mimetype[1], IQueryBuilder::PARAM_INT),
			'size' => $insert->createNamedParameter($size, IQueryBuilder::PARAM_INT),
			'mtime' => $insert->createNamedParameter(self::MTIME, IQueryBuilder::PARAM_INT),
			'storage_mtime' => $insert->createNamedParameter(self::MTIME, IQueryBuilder::PARAM_INT),
			'etag' => $insert->createNamedParameter(md5($path . 'etag')),
			'permissions' => $insert->createNamedParameter(Constants::PERMISSION_ALL, IQueryBuilder::PARAM_INT),
		])->executeStatement();
		return $insert->getLastInsertId();
	}
}
