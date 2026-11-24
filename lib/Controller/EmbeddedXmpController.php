<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\Xmp\EmbeddedXmpReader;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;
use OCP\IUser;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class EmbeddedXmpController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private EmbeddedXmpReader $reader,
	) {
		parent::__construct($appName, $request);
	}

	/** Answers the XMP packet each listed JPEG embeds (ADR 0023). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/embedded-xmp/lookup')]
	public function lookup(array $fileIds = []): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(['packets' => $this->reader->lookup($user, $fileIds)]));
	}
}
