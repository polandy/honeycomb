<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Immich\ImmichException;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IUser;

/** Runs an Immich route for the logged-in user and answers an Immich failure with its code (IMMICH-001). */
final class ImmichApi {
	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through DI. */
	public function __construct(
		private ApiResponse $api,
	) {
	}

	/**
	 * The handler's answer; a failure is `{"error": code}`, with the missing `scope` for a 403.
	 * @param \Closure(IUser): Response $handle
	 */
	public function forUser(\Closure $handle): Response {
		return $this->api->forUser(static function (IUser $user) use ($handle): Response {
			try {
				return $handle($user);
			} catch (ImmichException $failure) {
				$body = ['error' => $failure->error->value];
				if ($failure->scope !== null) {
					$body['scope'] = $failure->scope;
				}
				return new JSONResponse($body, $failure->error->status());
			}
		});
	}
}
