<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\Service\Decision\FlagService;
use OCA\Honeycomb\Service\Files\UserFolderResolver;
use OCA\Honeycomb\Service\Files\UserPhotos;
use OCA\Honeycomb\Service\Image\ImageService;
use OCA\Honeycomb\Service\Listing\EntryFactory;
use OCA\Honeycomb\Service\Listing\ListingService;
use OCA\Honeycomb\Service\Settings\SettingsService;
use OCA\Honeycomb\Service\Source\FolderPictureSource;
use OCA\Honeycomb\Service\Stats\StatsDay;
use OCA\Honeycomb\Service\Stats\StatsService;
use OCA\Honeycomb\Tests\Service\FakeFlagStore;
use OCA\Honeycomb\Tests\Service\FakePreviewLock;
use OCA\Honeycomb\Tests\Service\FakeQualityStore;
use OCA\Honeycomb\Tests\Service\FakeStatsStore;
use OCA\Honeycomb\Tests\Service\FakeVisualHashStore;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Config\IUserConfig;
use OCP\Files\IRootFolder;
use OCP\FilesMetadata\IFilesMetadataManager;
use OCP\IPreview;
use Psr\Log\LoggerInterface;

/** The folder picture source over the service a controller test exercises, the others over empty stubs. */
trait FolderSourceFixture {
	private function folderSource(?ListingService $listing = null, ?ImageService $images = null, ?FlagService $flags = null): FolderPictureSource {
		$root = $this->createStub(IRootFolder::class);
		$config = $this->createStub(IUserConfig::class);
		$time = $this->createStub(ITimeFactory::class);
		$logger = $this->createStub(LoggerInterface::class);
		return new FolderPictureSource(
			$listing ?? new ListingService(new UserFolderResolver($root), new EntryFactory($this->createStub(IFilesMetadataManager::class), new FakeVisualHashStore(), new FakeFlagStore(), new FakeQualityStore())),
			$images ?? new ImageService(new UserPhotos(new UserFolderResolver($root)), $this->createStub(IPreview::class), $logger, new FakePreviewLock()),
			$flags ?? new FlagService(new FakeFlagStore(), new UserPhotos(new UserFolderResolver($root)), $time, new StatsService(new FakeStatsStore(), new StatsDay($config, $time), new SettingsService($config), $logger)),
		);
	}
}
