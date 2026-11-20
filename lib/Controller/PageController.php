<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Service\AppVisits;
use OCA\Honeycomb\Service\ScriptManifest;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\ContentSecurityPolicy;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IGroupManager;
use OCP\IRequest;
use OCP\IUserSession;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class PageController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private ScriptManifest $scripts,
		private IUserSession $userSession,
		private IGroupManager $groups,
		private AppVisits $visits,
	) {
		parent::__construct($appName, $request);
	}

	/** The app page, its hashed script (APP-001.10) and whether the user is an admin (SETTINGS-001.27); records the visit (IMAGES-001.16). */
	#[NoAdminRequired]
	#[NoCSRFRequired]
	#[FrontpageRoute(verb: 'GET', url: '/')]
	public function index(): TemplateResponse {
		$user = $this->userSession->getUser();
		if ($user !== null) {
			$this->visits->record($user);
		}
		return $this->withHashWorkers(new TemplateResponse(Application::APP_ID, 'main', [
			'script' => $this->scripts->script(ScriptManifest::MAIN),
			'admin' => $this->isAdmin(),
		]));
	}

	/** The page that computes the missing visual hashes of a folder tree in Web Workers (ADR 0025). */
	#[NoAdminRequired]
	#[NoCSRFRequired]
	#[FrontpageRoute(verb: 'GET', url: '/similarity')]
	public function similarity(): TemplateResponse {
		return $this->withHashWorkers(new TemplateResponse(Application::APP_ID, 'similarity', ['script' => $this->scripts->script(ScriptManifest::SIMILARITY)]));
	}

	/** The statistics page of the user's culling (STATS-001.40). */
	#[NoAdminRequired]
	#[NoCSRFRequired]
	#[FrontpageRoute(verb: 'GET', url: '/statistics')]
	public function statistics(): TemplateResponse {
		return new TemplateResponse(Application::APP_ID, 'statistics', ['script' => $this->scripts->script(ScriptManifest::STATISTICS)]);
	}

	private function isAdmin(): bool {
		$user = $this->userSession->getUser();
		return $user !== null && $this->groups->isAdmin($user->getUID());
	}

	/** Lets the page start the hash workers of its own origin (SERIES-003.26, SERIES-004.13). */
	private function withHashWorkers(TemplateResponse $response): TemplateResponse {
		$policy = new ContentSecurityPolicy();
		$policy->addAllowedWorkerSrcDomain("'self'");
		$response->setContentSecurityPolicy($policy);
		return $response;
	}
}
