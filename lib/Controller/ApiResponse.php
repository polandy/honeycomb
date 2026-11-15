<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\FolderNotFoundException;
use OCA\Honeycomb\Service\FolderNotReadableException;
use OCA\Honeycomb\Service\ImageNotFoundException;
use OCA\Honeycomb\Service\ImageNotReadableException;
use OCA\Honeycomb\Service\InvalidRequestException;
use OCA\Honeycomb\Service\TrashBinDisabledException;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IUser;
use OCP\IUserSession;

/** Runs a route for the logged-in user and answers each known service failure with its status. */
final class ApiResponse {
	/** The status of each service failure; any other exception is a server error. */
	private const array STATUS = [
		InvalidRequestException::class => Http::STATUS_BAD_REQUEST,
		FolderNotFoundException::class => Http::STATUS_NOT_FOUND,
		ImageNotFoundException::class => Http::STATUS_NOT_FOUND,
		FolderNotReadableException::class => Http::STATUS_FORBIDDEN,
		ImageNotReadableException::class => Http::STATUS_FORBIDDEN,
		TrashBinDisabledException::class => Http::STATUS_CONFLICT,
	];

	public function __construct(
		private IUserSession $userSession,
	) {
	}

	/**
	 * The handler's answer for the user; 401 without one, the status of a known failure with the body `[]`.
	 * @param \Closure(IUser): Response $handle
	 */
	public function forUser(\Closure $handle): Response {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new JSONResponse([], Http::STATUS_UNAUTHORIZED);
		}
		try {
			return $handle($user);
		} catch (\Exception $failure) {
			return new JSONResponse([], $this->statusOf($failure));
		}
	}

	/** @return 400|403|404|409 */
	private function statusOf(\Exception $failure): int {
		foreach (self::STATUS as $class => $status) {
			if ($failure instanceof $class) {
				return $status;
			}
		}
		throw $failure;
	}
}
