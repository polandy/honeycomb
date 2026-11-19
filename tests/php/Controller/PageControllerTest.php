<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\PageController;
use OCA\Honeycomb\Service\ScriptManifest;
use OCP\App\IAppManager;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

final class PageControllerTest extends TestCase {
	// spec: APP-001.1
	public function testIndexRendersTheMainTemplateForTheUser(): void {
		$response = $this->controller()->index();

		$this->assertSame(Application::APP_ID, $response->getApp());
		$this->assertSame('main', $response->getTemplateName());
		$this->assertSame(TemplateResponse::RENDER_AS_USER, $response->getRenderAs());
	}

	// spec: APP-001.10
	public function testEachPageLoadsItsBuiltScriptByItsHashedName(): void {
		$controller = $this->controller();

		$this->assertSame('honeycomb-main-Ab1_cD2e', $controller->index()->getParams()['script']);
		$this->assertSame(['script' => 'honeycomb-similarity-Xy9-Zw8v'], $controller->similarity()->getParams());
	}

	/** The controller over the built script manifest of the fixtures. */
	private function controller(): PageController {
		$apps = $this->createStub(IAppManager::class);
		$apps->method('getAppPath')->willReturn(__DIR__ . '/../../fixtures/script-manifest/built');
		return new PageController(Application::APP_ID, $this->createStub(IRequest::class), new ScriptManifest($apps));
	}

	// spec: APP-001.1
	public function testIndexIsTheAppRootForEveryUser(): void {
		$method = new ReflectionMethod(PageController::class, 'index');

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => 'GET', 'url' => '/'], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(1, $method->getAttributes(NoCSRFRequired::class));
	}

	// spec: SERIES-003.26
	public function testIndexAllowsTheHashWorkers(): void {
		$controller = $this->controller();

		$policy = $controller->index()->getContentSecurityPolicy();

		$this->assertNotNull($policy);
		$this->assertStringContainsString("worker-src 'self'", $policy->buildPolicy());
	}

	// spec: SERIES-004.13
	public function testSimilarityRendersItsTemplateAndAllowsItsWorkers(): void {
		$controller = $this->controller();

		$response = $controller->similarity();

		$this->assertSame('similarity', $response->getTemplateName());
		$this->assertSame(TemplateResponse::RENDER_AS_USER, $response->getRenderAs());
		$policy = $response->getContentSecurityPolicy();
		$this->assertNotNull($policy);
		$this->assertStringContainsString("worker-src 'self'", $policy->buildPolicy());
	}

	// spec: SERIES-004.13
	public function testSimilarityIsAPageForEveryUser(): void {
		$method = new ReflectionMethod(PageController::class, 'similarity');

		$this->assertSame(['verb' => 'GET', 'url' => '/similarity'], $method->getAttributes(FrontpageRoute::class)[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(1, $method->getAttributes(NoCSRFRequired::class));
	}
}
