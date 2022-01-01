# <%= params.extensionName %>

![License](https://img.shields.io/badge/license-<%= params.licenseType %>-blue.svg) [![Latest Stable Version](https://img.shields.io/packagist/v/<%= params.packageName %>.svg)](https://packagist.org/packages/<%= params.packageName %>) [![Total Downloads](https://img.shields.io/packagist/dt/<%= params.packageName %>.svg)](https://packagist.org/packages/<%= params.packageName %>)

A [Flarum](http://flarum.org) extension. <%= params.packageDescription %>

## Installation

Install with composer:

```sh
composer require <%= params.packageName %>:"*"
```

## Updating

```sh
composer update <%= params.packageName %>:"*"
php flarum migrate
php flarum cache:clear
```

## Links

- [Packagist](https://packagist.org/packages/<%= params.packageName %>)
- [GitHub](https://github.com/<%= params.packageName %>)
- [Discuss](https://discuss.flarum.org/d/PUT_DISCUSS_SLUG_HERE)
