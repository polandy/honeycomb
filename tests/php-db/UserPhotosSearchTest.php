<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Service\Files\UserPhotos;
use OCP\Constants;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\IConfig;
use OCP\IUser;
use OCP\IUserManager;
use OCP\Server;
use OCP\Share\IManager as IShareManager;
use OCP\Share\IShare;

/** The batch lookup of `UserPhotos` in a real Nextcloud: the ids a user reaches, shares included (ADR 0038). */
final class UserPhotosSearchTest extends DbTestCase {
	private const string USER = 'honeycomb-reach';
	private const string PASSWORD = 'honeycomb-reach-Passw0rd-long!';
	private const string QUERY_LOG = '/tmp/honeycomb-reach-queries.log';
	private const int UNKNOWN_ID = 2_000_000_000;

	private static int $tests = 0;

	private IUserManager $users;

	/** The user and the sharing user of this test, new per test: a user's mounts are set up once per process. */
	private string $uid;
	private string $otherUid;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->users = Server::get(IUserManager::class);
		$this->uid = self::USER . '-' . ++self::$tests;
		$this->otherUid = $this->uid . '-other';
		foreach ([$this->uid, $this->otherUid] as $uid) {
			$this->users->get($uid)?->delete();
			$this->users->createUser($uid, self::PASSWORD);
		}
	}

	#[\Override]
	protected function tearDown(): void {
		Server::get(IConfig::class)->deleteSystemValue('query_log_file');
		foreach ([$this->uid, $this->otherUid] as $uid) {
			$this->users->get($uid)?->delete();
		}
		parent::tearDown();
	}

	private function photos(): UserPhotos {
		return Server::get(UserPhotos::class);
	}

	private function user(): IUser {
		$user = $this->users->get($this->uid);
		$this->assertNotNull($user);
		return $user;
	}

	private function home(string $uid): Folder {
		return Server::get(IRootFolder::class)->getUserFolder($uid);
	}

	/** The file id of a new file at `$path` in `$folder`, its folders created. */
	private function newFile(Folder $folder, string $path): int {
		foreach (explode('/', dirname($path)) as $name) {
			$next = $folder->nodeExists($name) ? $folder->get($name) : $folder->newFolder($name);
			$this->assertInstanceOf(Folder::class, $next);
			$folder = $next;
		}
		return $folder->newFile(basename($path), 'x')->getId();
	}

	private function share(Folder $folder): void {
		$shares = Server::get(IShareManager::class);
		$share = $shares->newShare();
		$share->setNode($folder)->setShareType(IShare::TYPE_USER)->setSharedWith($this->uid)
			->setSharedBy($this->otherUid)->setShareOwner($this->otherUid)->setPermissions(Constants::PERMISSION_READ);
		$shares->createShare($share);
	}

	/** How many queries `$run` sends to the database. */
	private function queries(\Closure $run): int {
		$before = self::loggedQueries();
		Server::get(IConfig::class)->setSystemValue('query_log_file', self::QUERY_LOG);
		$run();
		Server::get(IConfig::class)->deleteSystemValue('query_log_file');
		return self::loggedQueries() - $before;
	}

	private static function loggedQueries(): int {
		$lines = is_file(self::QUERY_LOG) ? file(self::QUERY_LOG) : [];
		return $lines === false ? 0 : count($lines);
	}

	// spec: XMP-006.3, XMP-006.11
	public function testReachesTheSameIdsAsALookupOfEach(): void {
		$other = $this->home($this->otherUid);
		$shared = $this->newFile($other, 'Shared/S.JPG');
		$sharedFolder = $other->get('Shared');
		$this->assertInstanceOf(Folder::class, $sharedFolder);
		$this->share($sharedFolder);
		$foreign = $this->newFile($other, 'Private/X.JPG');
		$home = $this->home($this->uid);
		$jpeg = $this->newFile($home, 'P/A.JPG');
		$raw = $this->newFile($home, 'P/A.CR3');
		$sidecar = $this->newFile($home, 'P/A.CR3.xmp');
		$text = $this->newFile($home, 'P/notes.txt');
		$folderId = $home->get('P')->getId();
		$fileIds = [$foreign, $text, $shared, self::UNKNOWN_ID, $raw, $folderId, $sidecar, $jpeg];

		$photos = $this->photos()->photos($this->user(), $fileIds);

		$this->assertSame([$shared, $raw, $jpeg], $photos);
		$this->assertSame(array_values(array_filter($fileIds, fn (int $id): bool => $this->photos()->photo($home, $id) !== null)), $photos);
		$this->assertSame([$sidecar], $this->photos()->sidecars($this->user(), $fileIds));
		$this->assertSame([$shared, $jpeg], $this->photos()->jpegs($this->user(), $fileIds));
	}

	// spec: XMP-006.11
	public function testAddsOneQueryPerThousandIds(): void {
		$jpeg = $this->newFile($this->home($this->uid), 'P/A.JPG');
		$this->photos()->photos($this->user(), [$jpeg]);

		$one = $this->queries(fn () => $this->assertSame([$jpeg], $this->photos()->photos($this->user(), [$jpeg])));
		$many = $this->queries(fn () => $this->assertSame([$jpeg], $this->photos()->photos($this->user(), [$jpeg, ...range(self::UNKNOWN_ID, self::UNKNOWN_ID + 2_498)])));

		$this->assertSame($one + 2, $many);
	}
}
