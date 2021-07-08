# Changelog

## [1.0.0-alpha.6](https://github.com/flarum/flarum-cli/compare/5351123...v1.0.0-alpha.6)

### Added

- API Controller class generation.
- Routes extender generation.
- Model class generation with table migration.
- Service Provider class generation with extender.
- Job class generation.

### Changed

- Migration generation detects table creation migrations (https://github.com/flarum/flarum-cli/commit/e443a32e1311795163b0768425910a3fe8aefc9e)
- Switched to official `mem-fs` package (https://github.com/flarum/flarum-cli/commit/f644589f9e9caedac128c383005a58dfc5f696db)
- Update extension boilerplate flarum core version (https://github.com/flarum/flarum-cli/commit/538fcc54646c67abd3951f9c304b8e1e08e29b96)

### Fixed

- Used fully qualified class names when namespace was imported (https://github.com/flarum/flarum-cli/commit/a9f696d14d1df15a0d90e44aeef570dfeb9f4f0e)
- Chained steps not applying previous steps filesystem changes (https://github.com/flarum/flarum-cli/commit/f9fbd92a7525c1a40fc80db24c79b81abb684288)
