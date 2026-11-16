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
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

final class PageControllerTest extends TestCase {
	// spec: APP-001.1
	public function testIndexRendersTheMainTemplateForTheUser(): void {
		$response = $this->controller(true)->index();

		$this->assertSame(Application::APP_ID, $response->getApp());
		$this->assertSame('main', $response->getTemplateName());
		$this->assertSame(TemplateResponse::RENDER_AS_USER, $response->getRenderAs());
	}

	// spec: SETTINGS-001.26
	public function testIndexTellsThePageWhetherTheVersionsAppIsOnForTheUser(): void {
		$this->assertTrue($this->controller(true)->index()->getParams()['versionsApp']);
		$this->assertFalse($this->controller(false)->index()->getParams()['versionsApp']);
	}

	// spec: APP-001.10
	public function testEachPageLoadsItsBuiltScriptByItsHashedName(): void {
		$controller = $this->controller(true);

		$this->assertSame('honeycomb-main-Ab1_cD2e', $controller->index()->getParams()['script']);
		$this->assertSame(['script' => 'honeycomb-similarity-Xy9-Zw8v'], $controller->similarity()->getParams());
	}

	/** The controller for a logged-in user with `files_versions` on or off for them. */
	private function controller(bool $versionsApp): PageController {
		$user = $this->createStub(IUser::class);
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($user);
		$apps = $this->createStub(IAppManager::class);
		$apps->method('isEnabledForUser')->willReturnCallback(static fn (string $app, ?IUser $for): bool => $app === 'files_versions' && $for === $user && $versionsApp);
		$apps->method('getAppPath')->willReturn(__DIR__ . '/../../fixtures/script-manifest/built');
		return new PageController(Application::APP_ID, $this->createStub(IRequest::class), $apps, $session, new ScriptManifest($apps));
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
		$controller = $this->controller(true);

		$policy = $controller->index()->getContentSecurityPolicy();

		$this->assertNotNull($policy);
		$this->assertStringContainsString("worker-src 'self'", $policy->buildPolicy());
	}

	// spec: SERIES-004.13
	public function testSimilarityRendersItsTemplateAndAllowsItsWorkers(): void {
		$controller = $this->controller(true);

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
