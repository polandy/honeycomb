<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\AppInfo;

use OCA\Honeycomb\Db\AppDataMapper;
use OCA\Honeycomb\Db\FileCacheLookup;
use OCA\Honeycomb\Db\FileCachePictures;
use OCA\Honeycomb\Db\FlagMapper;
use OCA\Honeycomb\Db\ImmichDecisionMapper;
use OCA\Honeycomb\Db\PositionMapper;
use OCA\Honeycomb\Db\QualityMapper;
use OCA\Honeycomb\Db\SeriesMapper;
use OCA\Honeycomb\Db\StatsMapper;
use OCA\Honeycomb\Db\TagMapper;
use OCA\Honeycomb\Db\VisualHashMapper;
use OCA\Honeycomb\Db\XmpCacheMapper;
use OCA\Honeycomb\Immich\ImmichDecisionStore;
use OCA\Honeycomb\Immich\LocalFiles;
use OCA\Honeycomb\Immich\PhpLocalFiles;
use OCA\Honeycomb\Listener\ForgetDeletedUser;
use OCA\Honeycomb\Listener\RenderWrittenPhotos;
use OCA\Honeycomb\Preview\JpegDecoder;
use OCA\Honeycomb\Preview\OcpJpegDecoder;
use OCA\Honeycomb\Preview\RawPreviewProvider;
use OCA\Honeycomb\Service\AppData;
use OCA\Honeycomb\Service\ExistingFiles;
use OCA\Honeycomb\Service\FlagStore;
use OCA\Honeycomb\Service\Pause;
use OCA\Honeycomb\Service\PicturesBelow;
use OCA\Honeycomb\Service\PositionStore;
use OCA\Honeycomb\Service\PreviewLock;
use OCA\Honeycomb\Service\QualityStore;
use OCA\Honeycomb\Service\SemaphorePreviewLock;
use OCA\Honeycomb\Service\SeriesStore;
use OCA\Honeycomb\Service\StatsStore;
use OCA\Honeycomb\Service\SystemPause;
use OCA\Honeycomb\Service\TagStore;
use OCA\Honeycomb\Service\VisualHashStore;
use OCA\Honeycomb\Service\XmpCacheStore;
use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use OCP\Files\Events\Node\NodeWrittenEvent;
use OCP\User\Events\UserDeletedEvent;

/** @psalm-suppress UnusedClass Nextcloud loads it by the namespace in info.xml. */
final class Application extends App implements IBootstrap {
	public const APP_ID = 'honeycomb';

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct() {
		parent::__construct(self::APP_ID);
	}

	#[\Override]
	public function register(IRegistrationContext $context): void {
		$context->registerServiceAlias(JpegDecoder::class, OcpJpegDecoder::class);
		$context->registerServiceAlias(FlagStore::class, FlagMapper::class);
		$context->registerServiceAlias(PositionStore::class, PositionMapper::class);
		$context->registerServiceAlias(SeriesStore::class, SeriesMapper::class);
		$context->registerServiceAlias(StatsStore::class, StatsMapper::class);
		$context->registerServiceAlias(TagStore::class, TagMapper::class);
		$context->registerServiceAlias(QualityStore::class, QualityMapper::class);
		$context->registerServiceAlias(AppData::class, AppDataMapper::class);
		$context->registerServiceAlias(VisualHashStore::class, VisualHashMapper::class);
		$context->registerServiceAlias(XmpCacheStore::class, XmpCacheMapper::class);
		$context->registerServiceAlias(ExistingFiles::class, FileCacheLookup::class);
		$context->registerServiceAlias(PicturesBelow::class, FileCachePictures::class);
		$context->registerServiceAlias(Pause::class, SystemPause::class);
		$context->registerServiceAlias(PreviewLock::class, SemaphorePreviewLock::class);
		$context->registerServiceAlias(LocalFiles::class, PhpLocalFiles::class);
		$context->registerServiceAlias(ImmichDecisionStore::class, ImmichDecisionMapper::class);
		$context->registerEventListener(UserDeletedEvent::class, ForgetDeletedUser::class);
		$context->registerEventListener(NodeWrittenEvent::class, RenderWrittenPhotos::class);
		$context->registerPreviewProvider(RawPreviewProvider::class, RawPreviewProvider::MIME_TYPE_REGEX);
	}

	#[\Override]
	public function boot(IBootContext $context): void {
	}
}
