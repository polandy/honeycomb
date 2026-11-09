<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\PageController;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;
use PHPUnit\Framework\TestCase;

final class PageControllerTest extends TestCase {
	public function testIndexRendersTheMainTemplateForTheUser(): void {
		$controller = new PageController(Application::APP_ID, $this->createStub(IRequest::class));

		$response = $controller->index();

		$this->assertSame(Application::APP_ID, $response->getApp());
		$this->assertSame('main', $response->getTemplateName());
		$this->assertSame(TemplateResponse::RENDER_AS_USER, $response->getRenderAs());
	}
}
