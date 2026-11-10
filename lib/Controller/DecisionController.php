<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\DecisionService;
use OCA\Honeycomb\Service\InvalidDecisionException;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;
use OCP\IUserSession;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class DecisionController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private IUserSession $userSession,
		private DecisionService $decisions,
	) {
		parent::__construct($appName, $request);
	}

	/** The user's stored decisions among the file ids (ADR 0012). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/decisions/lookup')]
	public function lookup(array $fileIds = []): JSONResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new JSONResponse([], Http::STATUS_UNAUTHORIZED);
		}
		try {
			return new JSONResponse(['decisions' => $this->decisions->lookup($user, $fileIds)]);
		} catch (InvalidDecisionException) {
			return new JSONResponse([], Http::STATUS_BAD_REQUEST);
		}
	}

	/** Replaces the user's decisions on the files with the whole states given (ADR 0012). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'PUT', url: '/api/v1/decisions')]
	public function save(array $decisions = []): Response {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new Response(Http::STATUS_UNAUTHORIZED);
		}
		try {
			$this->decisions->save($user, $decisions);
			return new Response(Http::STATUS_NO_CONTENT);
		} catch (InvalidDecisionException) {
			return new Response(Http::STATUS_BAD_REQUEST);
		}
	}
}
