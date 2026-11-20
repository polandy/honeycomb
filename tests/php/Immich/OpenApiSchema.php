<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

/** Checks request and answer bodies against the pinned Immich schema (ADR 0044), for the keywords it uses. */
final class OpenApiSchema {
	private const string FILE = __DIR__ . '/../../fixtures/immich/openapi.json';
	private const string REF_PREFIX = '#/components/schemas/';

	/** @var array<string, mixed> */
	private array $spec;

	public function __construct() {
		/** @var array<string, mixed> $spec */
		$spec = json_decode($this->readFixture(self::FILE), true, 512, JSON_THROW_ON_ERROR);
		$this->spec = $spec;
	}

	/**
	 * The violations of a request body; strict: no unknown or deprecated field, since honeycomb writes it.
	 * @return list<string>
	 */
	public function requestViolations(string $method, string $path, mixed $body): array {
		$operation = $this->operation($method, $path);
		return $this->violations($body, $this->jsonSchema($operation['requestBody'] ?? null), '$', true);
	}

	/**
	 * The violations of an answer body; lenient on unknown fields, as a client reading a newer Immich must be.
	 * @return list<string>
	 */
	public function responseViolations(string $method, string $path, int $status, mixed $body): array {
		$operation = $this->operation($method, $path);
		/** @var array<array-key, mixed> $responses */
		$responses = $operation['responses'] ?? [];
		return $this->violations($body, $this->jsonSchema($responses[(string)$status] ?? null), '$', false);
	}

	/** @return array<string, mixed> */
	private function operation(string $method, string $path): array {
		/** @var array<string, array<string, array<string, mixed>>> $paths */
		$paths = $this->spec['paths'];
		$operation = $paths[$path][strtolower($method)] ?? null;
		if ($operation === null) {
			throw new \LogicException("The pinned schema has no $method $path");
		}
		return $operation;
	}

	/** @return array<string, mixed> */
	private function jsonSchema(mixed $part): array {
		if (!is_array($part)) {
			throw new \LogicException('The operation has no body of that kind');
		}
		/** @var array{content: array{'application/json': array{schema: array<string, mixed>}}} $part */
		return $part['content']['application/json']['schema'];
	}

	/**
	 * @param array<string, mixed> $schema
	 * @return list<string>
	 */
	private function violations(mixed $value, array $schema, string $at, bool $strict): array {
		if (isset($schema['$ref'])) {
			return $this->violations($value, $this->resolve((string)$schema['$ref']), $at, $strict);
		}
		if ($value === null) {
			return ($schema['nullable'] ?? false) === true || $schema === [] ? [] : ["$at is null"];
		}
		$found = [];
		/** @var list<array<string, mixed>> $parts */
		$parts = $schema['allOf'] ?? [];
		foreach ($parts as $part) {
			array_push($found, ...$this->violations($value, $part, $at, $strict));
		}
		if (isset($schema['enum']) && is_array($schema['enum']) && !in_array($value, $schema['enum'], true)) {
			$found[] = "$at is not one of the enum";
		}
		return [...$found, ...$this->typeViolations($value, $schema, $at, $strict)];
	}

	/**
	 * @param array<string, mixed> $schema
	 * @return list<string>
	 */
	private function typeViolations(mixed $value, array $schema, string $at, bool $strict): array {
		/** @var mixed $type */
		$type = $schema['type'] ?? null;
		return match ($type) {
			'object' => is_array($value) && !array_is_list($value) || $value === [] ? $this->objectViolations((array)$value, $schema, $at, $strict) : ["$at is not an object"],
			'array' => is_array($value) && array_is_list($value) ? $this->arrayViolations($value, $schema, $at, $strict) : ["$at is not an array"],
			'string' => is_string($value) ? $this->stringViolations($value, $schema, $at) : ["$at is not a string"],
			'integer' => is_int($value) ? $this->numberViolations($value, $schema, $at) : ["$at is not an integer"],
			'number' => is_int($value) || is_float($value) ? $this->numberViolations($value, $schema, $at) : ["$at is not a number"],
			'boolean' => is_bool($value) ? [] : ["$at is not a boolean"],
			default => isset($schema['properties']) && is_array($value) ? $this->objectViolations($value, $schema, $at, $strict) : [],
		};
	}

	/**
	 * @param array<array-key, mixed> $value
	 * @param array<string, mixed> $schema
	 * @return list<string>
	 */
	private function objectViolations(array $value, array $schema, string $at, bool $strict): array {
		/** @var array<string, array<string, mixed>> $properties */
		$properties = $schema['properties'] ?? [];
		/** @var list<string> $required */
		$required = $schema['required'] ?? [];
		$closed = $strict || ($schema['additionalProperties'] ?? true) === false;
		$found = [];
		foreach ($required as $name) {
			if (!array_key_exists($name, $value)) {
				$found[] = "$at.$name is missing";
			}
		}
		/** @var mixed $field */
		foreach ($value as $name => $field) {
			$property = $properties[(string)$name] ?? null;
			if ($property === null) {
				if ($closed) {
					$found[] = "$at.$name is not in the schema";
				}
				continue;
			}
			if ($strict && ($property['deprecated'] ?? false) === true) {
				$found[] = "$at.$name is deprecated";
			}
			array_push($found, ...$this->violations($field, $property, "$at.$name", $strict));
		}
		return $found;
	}

	/**
	 * @param list<mixed> $value
	 * @param array<string, mixed> $schema
	 * @return list<string>
	 */
	private function arrayViolations(array $value, array $schema, string $at, bool $strict): array {
		$found = count($value) < (int)($schema['minItems'] ?? 0) ? ["$at has too few items"] : [];
		/** @var array<string, mixed> $items */
		$items = $schema['items'] ?? [];
		/** @var mixed $item */
		foreach ($value as $index => $item) {
			array_push($found, ...$this->violations($item, $items, "{$at}[$index]", $strict));
		}
		return $found;
	}

	/**
	 * @param array<string, mixed> $schema
	 * @return list<string>
	 */
	private function stringViolations(string $value, array $schema, string $at): array {
		$found = strlen($value) < (int)($schema['minLength'] ?? 0) ? ["$at is too short"] : [];
		/** @var mixed $pattern */
		$pattern = $schema['pattern'] ?? null;
		if (is_string($pattern) && preg_match('/' . str_replace('/', '\/', $pattern) . '/u', $value) !== 1) {
			$found[] = "$at does not match its pattern";
		}
		return $found;
	}

	/**
	 * @param array<string, mixed> $schema
	 * @return list<string>
	 */
	private function numberViolations(int|float $value, array $schema, string $at): array {
		$below = isset($schema['minimum']) && $value < $schema['minimum'];
		$above = isset($schema['maximum']) && $value > $schema['maximum'];
		return $below || $above ? ["$at is out of range"] : [];
	}

	/** @return array<string, mixed> */
	private function resolve(string $ref): array {
		/** @var array{schemas: array<string, array<string, mixed>>} $components */
		$components = $this->spec['components'];
		return $components['schemas'][substr($ref, strlen(self::REF_PREFIX))] ?? throw new \LogicException("No schema $ref");
	}

	/** @psalm-suppress ForbiddenCode Reads the pinned schema fixture, not a user file. */
	private function readFixture(string $path): string {
		return (string)file_get_contents($path);
	}
}
