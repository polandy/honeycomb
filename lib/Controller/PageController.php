<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Service\ScriptManifest;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\ContentSecurityPolicy;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class PageController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private ScriptManifest $scripts,
	) {
		parent::__construct($appName, $request);
	}

	/** The app page and its hashed script (APP-001.10). */
	#[NoAdminRequired]
	#[NoCSRFRequired]
	#[FrontpageRoute(verb: 'GET', url: '/')]
	public function index(): TemplateResponse {
		return $this->withHashWorkers(new TemplateResponse(Application::APP_ID, 'main', ['script' => $this->scripts->script(ScriptManifest::MAIN)]));
	}

	/** The page that computes the missing visual hashes of a folder tree in Web Workers (ADR 0025). */
	#[NoAdminRequired]
	#[NoCSRFRequired]
	#[FrontpageRoute(verb: 'GET', url: '/similarity')]
	public function similarity(): TemplateResponse {
		return $this->withHashWorkers(new TemplateResponse(Application::APP_ID, 'similarity', ['script' => $this->scripts->script(ScriptManifest::SIMILARITY)]));
	}

	/** Lets the page start the hash workers of its own origin (SERIES-003.26, SERIES-004.13). */
	private function withHashWorkers(TemplateResponse $response): TemplateResponse {
		$policy = new ContentSecurityPolicy();
		$policy->addAllowedWorkerSrcDomain("'self'");
		$response->setContentSecurityPolicy($policy);
		return $response;
	}
}
