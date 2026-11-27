<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

/** The failed assets of one running write; after a final failure every call left fails with it. */
final class WriteProgress {
	/** After these no call gets through: Immich does not answer or refuses the key. */
	private const array FINAL = [ImmichError::Unreachable, ImmichError::Refused, ImmichError::Key];

	/** @var array<string, ImmichError> */
	private array $failed = [];
	private ?ImmichError $stopped = null;

	/** Fails the asset before any call, so none is sent for it. */
	public function fail(string $assetId, ImmichError $error): void {
		$this->failed[$assetId] = $error;
	}

	/** Whether the asset has failed. */
	public function hasFailed(string $assetId): bool {
		return isset($this->failed[$assetId]);
	}

	/** The asset's error, or null while it has not failed. */
	public function error(string $assetId): ?ImmichError {
		return $this->failed[$assetId] ?? null;
	}

	/**
	 * Makes one call for the assets and answers whether it went through; a failure fails them all, a success clears them.
	 * @param non-empty-list<string> $assetIds
	 * @param callable(): void $call
	 */
	public function call(array $assetIds, callable $call): bool {
		try {
			if ($this->stopped !== null) {
				throw new ImmichException($this->stopped);
			}
			$call();
			foreach ($assetIds as $assetId) {
				unset($this->failed[$assetId]);
			}
			return true;
		} catch (ImmichException $failure) {
			foreach ($assetIds as $assetId) {
				$this->failed[$assetId] = $failure->error;
			}
			if (in_array($failure->error, self::FINAL, true)) {
				$this->stopped = $failure->error;
			}
			return false;
		}
	}
}
