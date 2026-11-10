<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\AppInfo;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Preview\JpegDecoder;
use OCA\Honeycomb\Preview\OcpJpegDecoder;
use OCA\Honeycomb\Preview\RawPreviewProvider;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use PHPUnit\Framework\TestCase;

final class ApplicationTest extends TestCase {
	public function testRegistersThePreviewProviderForRawFiles(): void {
		$context = $this->createMock(IRegistrationContext::class);
		$context->expects($this->once())->method('registerPreviewProvider')->with(RawPreviewProvider::class, RawPreviewProvider::MIME_TYPE_REGEX);
		$context->expects($this->once())->method('registerServiceAlias')->with(JpegDecoder::class, OcpJpegDecoder::class);

		(new \ReflectionClass(Application::class))->newInstanceWithoutConstructor()->register($context);
	}
}
