<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\AppInfo;

use OCA\Honeycomb\Preview\JpegDecoder;
use OCA\Honeycomb\Preview\OcpJpegDecoder;
use OCA\Honeycomb\Preview\RawPreviewProvider;
use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IRegistrationContext;

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
		$context->registerPreviewProvider(RawPreviewProvider::class, RawPreviewProvider::MIME_TYPE_REGEX);
	}

	#[\Override]
	public function boot(IBootContext $context): void {
	}
}
