<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCP\App\IAppManager;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\ContentSecurityPolicy;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;
use OCP\IUserSession;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class PageController extends Controller {
	private const string VERSIONS_APP = 'files_versions';

	public function __construct(
		string $appName,
		IRequest $request,
		private IAppManager $appManager,
		private IUserSession $userSession,
	) {
		parent::__construct($appName, $request);
	}

	/** The app page; it tells the UI whether the Versions app is on for the user, which writing to sidecars needs (SETTINGS-001.26). */
	#[NoAdminRequired]
	#[NoCSRFRequired]
	#[FrontpageRoute(verb: 'GET', url: '/')]
	public function index(): TemplateResponse {
		$user = $this->userSession->getUser();
		$versionsApp = $user !== null && $this->appManager->isEnabledForUser(self::VERSIONS_APP, $user);
		return $this->withHashWorkers(new TemplateResponse(Application::APP_ID, 'main', ['versionsApp' => $versionsApp]));
	}

	/** The page that computes the missing visual hashes of a folder tree in Web Workers (ADR 0025). */
	#[NoAdminRequired]
	#[NoCSRFRequired]
	#[FrontpageRoute(verb: 'GET', url: '/similarity')]
	public function similarity(): TemplateResponse {
		return $this->withHashWorkers(new TemplateResponse(Application::APP_ID, 'similarity'));
	}

	/** Lets the page start the hash workers of its own origin (SERIES-003.26, SERIES-004.13). */
	private function withHashWorkers(TemplateResponse $response): TemplateResponse {
		$policy = new ContentSecurityPolicy();
		$policy->addAllowedWorkerSrcDomain("'self'");
		$response->setContentSecurityPolicy($policy);
		return $response;
	}
}
