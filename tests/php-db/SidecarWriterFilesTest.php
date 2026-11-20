<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Service\SidecarResult;
use OCA\Honeycomb\Service\SidecarWriter;
use OCP\App\IAppManager;
use OCP\Constants;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\IUser;
use OCP\IUserManager;
use OCP\Lock\ILockingProvider;
use OCP\Server;
use OCP\Share\IManager as IShareManager;
use OCP\Share\IShare;

/** The checked save against the files of a real Nextcloud, where the fakes of tests/php cannot show what the server refuses. */
final class SidecarWriterFilesTest extends DbTestCase {
	private const string USER = 'honeycomb-sidecar';
	private const string PASSWORD = 'honeycomb-sidecar-Passw0rd-long!';
	private const string PART = 'IMG_0001.NEF.xmp.part';

	private static int $tests = 0;

	private IUserManager $users;

	/** The user and the sharing user of this test, new per test: a user's mounts are set up once per process. */
	private string $uid;
	private string $otherUid;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		Server::get(IAppManager::class)->loadApp('files_versions');
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
		\OC\Files\Filesystem::reset();
		foreach ([$this->uid, $this->otherUid] as $uid) {
			$this->users->get($uid)?->delete();
		}
		parent::tearDown();
	}

	// spec: XMP-002.13
	public function testCreatesANewSidecarBesideItsImage(): void {
		$photos = $this->photos($this->uid);
		$photos->newFile('IMG_0002.JPG', 'jpeg');

		$results = $this->save([['path' => '/Photos/IMG_0002.JPG.xmp', 'content' => base64_encode('fresh')]]);

		$sidecar = $photos->get('IMG_0002.JPG.xmp');
		$this->assertInstanceOf(File::class, $sidecar);
		$this->assertSame('fresh', $sidecar->getContent());
		$this->assertSame([SidecarResult::Saved, $sidecar->getId()], [$results[0]['result'], $results[0]['fileId'] ?? null]);
		$this->assertSame(['IMG_0002.JPG', 'IMG_0002.JPG.xmp'], $this->stored($photos));
	}

	// spec: XMP-002.13
	public function testReplacesASidecarInPlaceAndKeepsTheOldBytesAsAVersion(): void {
		$this->hooksFor($this->uid);
		$photos = $this->photos($this->uid);
		$sidecar = $this->sidecarWithPart($photos);

		$results = $this->save([$this->existing($sidecar, 'new')]);

		$saved = $photos->get('IMG_0001.NEF.xmp');
		$this->assertInstanceOf(File::class, $saved);
		$this->assertSame(['new', $sidecar->getId()], [$saved->getContent(), $saved->getId()]);
		$this->assertSame([SidecarResult::Saved, $sidecar->getId(), $saved->getEtag()], [$results[0]['result'], $results[0]['fileId'] ?? null, $results[0]['etag'] ?? null]);
		$this->assertSame(['old'], $this->versions($saved));
		$this->assertSame('stale', $this->partBytes($photos));
		$this->assertSame(['IMG_0001.NEF', 'IMG_0001.NEF.xmp', self::PART], $this->stored($photos));
	}

	// spec: XMP-002.13
	public function testLeavesASidecarChangedSinceItWasRead(): void {
		$photos = $this->photos($this->uid);
		$sidecar = $this->sidecarWithPart($photos);

		$results = $this->save([['etag' => 'stale'] + $this->existing($sidecar, 'new')]);

		$this->assertSame([SidecarResult::Changed], array_column($results, 'result'));
		$this->assertSame('old', $sidecar->getContent());
		$this->assertSame(['IMG_0001.NEF', 'IMG_0001.NEF.xmp', self::PART], $this->stored($photos));
	}

	// spec: XMP-002.13
	public function testRefusesBothSavesInAFolderSharedReadOnly(): void {
		$theirs = $this->photos($this->otherUid);
		$theirs->newFile('IMG_0002.JPG', 'jpeg');
		$sidecar = $this->sidecarWithPart($theirs);
		$this->shareReadOnly($theirs);
		$shared = $this->home($this->uid)->get('Photos');
		$this->assertInstanceOf(Folder::class, $shared);
		$received = $shared->get('IMG_0001.NEF.xmp');
		$this->assertInstanceOf(File::class, $received);

		$results = $this->save([$this->existing($received, 'new'), ['path' => '/Photos/IMG_0002.JPG.xmp', 'content' => base64_encode('fresh')]]);

		$this->assertSame([SidecarResult::NotPermitted, SidecarResult::NotPermitted], array_column($results, 'result'));
		$this->assertSame('old', $sidecar->getContent());
		$this->assertSame(['IMG_0001.NEF', 'IMG_0001.NEF.xmp', self::PART, 'IMG_0002.JPG'], $this->stored($theirs));
	}

	// spec: XMP-002.13
	public function testReportsASidecarAnotherRequestHoldsALockOn(): void {
		$photos = $this->photos($this->uid);
		$sidecar = $this->sidecarWithPart($photos);
		$sidecar->lock(ILockingProvider::LOCK_SHARED);
		try {
			$results = $this->save([$this->existing($sidecar, 'new')]);
		} finally {
			$sidecar->unlock(ILockingProvider::LOCK_SHARED);
		}

		$this->assertSame([SidecarResult::Locked], array_column($results, 'result'));
		$this->assertSame('old', $sidecar->getContent());
		$this->assertSame(['IMG_0001.NEF', 'IMG_0001.NEF.xmp', self::PART], $this->stored($photos));
	}

	/**
	 * @param list<array<string, mixed>> $sidecars
	 * @return list<array{result: SidecarResult, fileId?: int, etag?: string, size?: int|float, mtime?: int}>
	 */
	private function save(array $sidecars): array {
		$user = $this->users->get($this->uid);
		$this->assertInstanceOf(IUser::class, $user);
		return Server::get(SidecarWriter::class)->save($user, $sidecars);
	}

	/** @return array<string, mixed> */
	private function existing(File $sidecar, string $content): array {
		return ['fileId' => $sidecar->getId(), 'etag' => $sidecar->getEtag(), 'size' => (int)$sidecar->getSize(), 'content' => base64_encode($content)];
	}

	private function home(string $uid): Folder {
		return Server::get(IRootFolder::class)->getUserFolder($uid);
	}

	private function photos(string $uid): Folder {
		return $this->home($uid)->newFolder('Photos');
	}

	/** A RAW with the sidecar `old` and, beside it, the part file an older save left on the storage. */
	private function sidecarWithPart(Folder $photos): File {
		$photos->newFile('IMG_0001.NEF', 'raw');
		$sidecar = $photos->newFile('IMG_0001.NEF.xmp', 'old');
		$photos->getStorage()->file_put_contents($photos->getInternalPath() . '/' . self::PART, 'stale');
		return $sidecar;
	}

	private function partBytes(Folder $photos): string|false {
		return $photos->getStorage()->file_get_contents($photos->getInternalPath() . '/' . self::PART);
	}

	/**
	 * The names on the folder's storage, part files included, which the file cache leaves out.
	 * @return list<string>
	 */
	private function stored(Folder $folder): array {
		$names = [];
		foreach ($folder->getStorage()->getDirectoryContent($folder->getInternalPath()) as $entry) {
			$names[] = $entry['name'];
		}
		sort($names);
		return $names;
	}

	/** Makes the user's files the process's default view, the only one whose writes fire the hooks the versions app listens to. */
	private function hooksFor(string $uid): void {
		\OC\Files\Filesystem::reset();
		\OC_Util::setupFS($uid);
	}

	/**
	 * The bytes of each version file the versions app keeps of the sidecar.
	 * @return list<string>
	 */
	private function versions(File $sidecar): array {
		$folder = Server::get(IRootFolder::class)->get('/' . $this->uid . '/files_versions/Photos');
		$this->assertInstanceOf(Folder::class, $folder);
		$bytes = [];
		foreach ($folder->getDirectoryListing() as $version) {
			if ($version instanceof File && str_starts_with($version->getName(), $sidecar->getName() . '.v')) {
				$bytes[] = $version->getContent();
			}
		}
		return $bytes;
	}

	private function shareReadOnly(Folder $folder): void {
		$shares = Server::get(IShareManager::class);
		$share = $shares->newShare();
		$share->setNode($folder)->setShareType(IShare::TYPE_USER)->setSharedWith($this->uid)
			->setSharedBy($this->otherUid)->setShareOwner($this->otherUid)->setPermissions(Constants::PERMISSION_READ);
		$shares->createShare($share);
	}
}
