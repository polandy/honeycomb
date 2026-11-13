<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\InvalidTagsException;
use OCA\Honeycomb\Service\TagService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;
use OCP\IUserSession;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class TagController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private IUserSession $userSession,
		private TagService $service,
	) {
		parent::__construct($appName, $request);
	}

	/** The user's stored tags among the file ids (ADR 0022). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/tags/lookup')]
	public function lookup(array $fileIds = []): JSONResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new JSONResponse([], Http::STATUS_UNAUTHORIZED);
		}
		try {
			return new JSONResponse(['tags' => $this->service->lookup($user, $fileIds)]);
		} catch (InvalidTagsException) {
			return new JSONResponse([], Http::STATUS_BAD_REQUEST);
		}
	}

	/** Replaces the user's tags on the files with the whole lists given (ADR 0022). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'PUT', url: '/api/v1/tags')]
	public function save(array $tags = []): Response {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new Response(Http::STATUS_UNAUTHORIZED);
		}
		try {
			$this->service->save($user, $tags);
			return new Response(Http::STATUS_NO_CONTENT);
		} catch (InvalidTagsException) {
			return new Response(Http::STATUS_BAD_REQUEST);
		}
	}

	/** Every tag the user has had, for autocomplete and the filter (ADR 0022). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/tags/list')]
	public function tagList(): JSONResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new JSONResponse([], Http::STATUS_UNAUTHORIZED);
		}
		return new JSONResponse(['tagList' => $this->service->tagList($user)]);
	}
}
