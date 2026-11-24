<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain;

/** The RAW and rendered extension lists of the user's pairing settings (LISTING-002), lower case. */
final readonly class PairingExtensions {
	/** The default RAW extensions of the pairing settings. */
	private const array RAW_EXTENSIONS = ['nef', 'cr2', 'cr3', 'arw', 'raf', 'orf', 'rw2', 'dng', 'pef', 'srw'];

	/** The default rendered extensions of the pairing settings. */
	private const array RENDERED_EXTENSIONS = ['jpg', 'jpeg', 'heic', 'heif', 'hif'];

	/** An extension of letters and digits only, as the settings accept it. */
	private const string EXTENSION = '/^[\p{L}\p{N}]+$/u';

	private const string SIDECAR = 'xmp';

	/** @param array<string, 'raw'|'rendered'> $roles each extension's role */
	private function __construct(
		private array $roles,
	) {
	}

	/** The default lists. */
	public static function defaults(): self {
		return self::fromRequest(null, null);
	}

	/**
	 * The lists a request sent, each left out one the default.
	 * @throws InvalidRequestException for an empty list, an invalid extension or one in both lists
	 */
	public static function fromRequest(mixed $raw, mixed $rendered): self {
		$roles = array_fill_keys(self::listed($raw ?? self::RAW_EXTENSIONS), 'raw');
		foreach (self::listed($rendered ?? self::RENDERED_EXTENSIONS) as $extension) {
			if (isset($roles[$extension])) {
				throw InvalidRequestException::because(Reason::Conflict, "the extension $extension is in both lists");
			}
			$roles[$extension] = 'rendered';
		}
		return new self($roles);
	}

	/** Whether a file of this extension is a RAW or a rendered member, or null for neither. */
	public function roleOf(string $extension): ?string {
		return $this->roles[strtolower($extension)] ?? null;
	}

	/**
	 * @return list<string> the lower-case extensions of `$value`
	 * @throws InvalidRequestException unless it is a non-empty list of valid extensions
	 */
	private static function listed(mixed $value): array {
		if (!is_array($value) || $value === [] || !array_is_list($value)) {
			throw InvalidRequestException::because(Reason::NotAList, 'an extension list must be a non-empty list');
		}
		return array_map(static function (mixed $extension): string {
			if (!is_string($extension) || preg_match(self::EXTENSION, $extension) !== 1 || strtolower($extension) === self::SIDECAR) {
				throw InvalidRequestException::because(Reason::BadValue, 'an extension must be letters and digits, not xmp');
			}
			return strtolower($extension);
		}, $value);
	}
}
