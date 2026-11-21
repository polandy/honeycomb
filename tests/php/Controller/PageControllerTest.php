<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\PageController;
use OCA\Honeycomb\Service\AppVisits;
use OCA\Honeycomb\Service\ScriptManifest;
use OCP\App\IAppManager;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\Config\IUserConfig;
use OCP\IGroupManager;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

final class PageControllerTest extends TestCase {
	/** @var list<string> the users whose visit was stored */
	private array $visited = [];

	// spec: IMAGES-001.16
	public function testIndexRemembersThatTheUserOpenedHoneycomb(): void {
		$this->controller()->index();
		$this->controller(signedIn: false)->index();

		$this->assertSame(['alice'], $this->visited);
	}

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
		$this->assertSame(['script' => 'honeycomb-statistics-Qr7_St6u'], $controller->statistics()->getParams());
		$this->assertSame(['script' => 'honeycomb-orphaned-sidecars-Mn4_Op5q'], $controller->orphanedSidecars()->getParams());
	}

	// spec: XMP-009.13
	public function testOrphanedSidecarsIsAPageOfItsOwnForEveryUser(): void {
		$method = new ReflectionMethod(PageController::class, 'orphanedSidecars');

		$this->assertSame(['verb' => 'GET', 'url' => '/orphaned-sidecars'], $method->getAttributes(FrontpageRoute::class)[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(1, $method->getAttributes(NoCSRFRequired::class));
		$this->assertSame('orphaned-sidecars', $this->controller()->orphanedSidecars()->getTemplateName());
	}

	// spec: STATS-001.40
	public function testStatisticsIsAPageOfItsOwnForEveryUser(): void {
		$method = new ReflectionMethod(PageController::class, 'statistics');

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => 'GET', 'url' => '/statistics'], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(1, $method->getAttributes(NoCSRFRequired::class));
		$this->assertSame('statistics', $this->controller()->statistics()->getTemplateName());
	}

	// spec: SETTINGS-001.27
	public function testIndexTellsThePageWhetherTheUserIsAnAdmin(): void {
		$this->assertTrue($this->controller(admin: true)->index()->getParams()['admin']);
		$this->assertFalse($this->controller(admin: false)->index()->getParams()['admin']);
		$this->assertFalse($this->controller(admin: true, signedIn: false)->index()->getParams()['admin']);
	}

	/** The controller over the built script manifest of the fixtures, for a user who is an admin or not. */
	private function controller(bool $admin = false, bool $signedIn = true): PageController {
		$apps = $this->createStub(IAppManager::class);
		$apps->method('getAppPath')->willReturn(__DIR__ . '/../../fixtures/script-manifest/built');
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($signedIn ? $user : null);
		$groups = $this->createStub(IGroupManager::class);
		$groups->method('isAdmin')->willReturnCallback(static fn (string $uid): bool => $admin && $uid === 'alice');
		$config = $this->createStub(IUserConfig::class);
		$config->method('setValueBool')->willReturnCallback(function (string $userId): bool {
			$this->visited[] = $userId;
			return true;
		});
		return new PageController(Application::APP_ID, $this->createStub(IRequest::class), new ScriptManifest($apps), $session, $groups, new AppVisits($config));
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
