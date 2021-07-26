# Changelog

## [1.0.0](https://github.com/flarum/flarum-cli/compare/5351123...v1.0.0)

### Added

- Model class generation with chained generation of related classes.
- API Controller class generation.
- API Serializer class generation.
- Routes extender generation.
- Job class generation.
- Policy class generation with extender.
- Repository class generation.
- Domain Handler class generation.
- Validator class generation.
- Console Command class generation with extender.
- Service Provider class generation with extender.
- Integration Test class generation.
- Frontend Model generation with its definition.
- Frontend Modal component generation.

### Changed

- Migration generation detects table creation migrations (https://github.com/flarum/flarum-cli/commit/e443a32e1311795163b0768425910a3fe8aefc9e)
- Switched to official `mem-fs` package (https://github.com/flarum/flarum-cli/commit/f644589f9e9caedac128c383005a58dfc5f696db)
- Update extension boilerplate flarum core version (https://github.com/flarum/flarum-cli/commit/538fcc54646c67abd3951f9c304b8e1e08e29b96)
- Extracted abstract base class for php and js stub generation (https://github.com/flarum/flarum-cli/commit/13a3d5d6c14c7ed5692b936ebd8398d2b1c0f2d0)
- Minimal formatting for extender method calls (https://github.com/flarum/flarum-cli/commit/a28c8a8b3abb7b258c0624c73d0b75c25f6441be)
- Filled generated locale file with extension id and link to docs (https://github.com/flarum/flarum-cli/commit/2ae530a0cf45826abca2200899e003515de24cd6)

### Fixed

- Used fully qualified class names when namespace was imported (https://github.com/flarum/flarum-cli/commit/a9f696d14d1df15a0d90e44aeef570dfeb9f4f0e)
- Chained steps not applying previous steps filesystem changes (https://github.com/flarum/flarum-cli/commit/f9fbd92a7525c1a40fc80db24c79b81abb684288)
- Dynamic `xClassName` parameters not properly filled (https://github.com/flarum/flarum-cli/commit/032495fba5b8267a960154a7d5f7547b5f7daa5c)
- Extension boilerplate outdated flarum core version (https://github.com/flarum/flarum-cli/commit/538fcc54646c67abd3951f9c304b8e1e08e29b96)
