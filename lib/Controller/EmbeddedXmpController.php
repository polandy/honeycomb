<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\EmbeddedXmpReader;
use OCA\Honeycomb\Service\InvalidSidecarRequestException;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;
use OCP\IUserSession;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class EmbeddedXmpController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private IUserSession $userSession,
		private EmbeddedXmpReader $reader,
	) {
		parent::__construct($appName, $request);
	}

	/** Answers the XMP packet each listed JPEG embeds (ADR 0023). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/embedded-xmp/lookup')]
	public function lookup(array $fileIds = []): JSONResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new JSONResponse([], Http::STATUS_UNAUTHORIZED);
		}
		try {
			return new JSONResponse(['packets' => $this->reader->lookup($user, $fileIds)]);
		} catch (InvalidSidecarRequestException) {
			return new JSONResponse([], Http::STATUS_BAD_REQUEST);
		}
	}
}
