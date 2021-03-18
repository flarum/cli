flarum-cli
==========

A CLI for developing Flarum extensions

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/flarum-cli.svg)](https://npmjs.org/package/flarum-cli)
[![Downloads/week](https://img.shields.io/npm/dw/flarum-cli.svg)](https://npmjs.org/package/flarum-cli)
[![License](https://img.shields.io/npm/l/flarum-cli.svg)](https://github.com/flarum/flarum-cli/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g flarum-cli
$ flarum-cli COMMAND
running command...
$ flarum-cli (-v|--version|version)
flarum-cli/0.0.0 linux-x64 node-v12.18.4
$ flarum-cli --help [COMMAND]
USAGE
  $ flarum-cli COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`flarum-cli generate:backend:event-listener [FILE]`](#flarum-cli-generatebackendevent-listener-file)
* [`flarum-cli generate:migration [PATH]`](#flarum-cli-generatemigration-path)
* [`flarum-cli help [COMMAND]`](#flarum-cli-help-command)
* [`flarum-cli infra:backend-testing [PATH]`](#flarum-cli-infrabackend-testing-path)
* [`flarum-cli init [PATH]`](#flarum-cli-init-path)
* [`flarum-cli update:js-imports [PATH]`](#flarum-cli-updatejs-imports-path)

## `flarum-cli generate:backend:event-listener [FILE]`

describe the command here

```
USAGE
  $ flarum-cli generate:backend:event-listener [FILE]

OPTIONS
  -f, --force
  -h, --help       show CLI help
  -n, --name=name  name to print
```

_See code: [src/commands/generate/backend/event-listener.ts](https://github.com/flarum/flarum-cli/blob/v0.0.0/src/commands/generate/backend/event-listener.ts)_

## `flarum-cli generate:migration [PATH]`

generate an empty migration template

```
USAGE
  $ flarum-cli generate:migration [PATH]

ARGUMENTS
  PATH  [default: /home/Programming/Projects/flarum/flarum-cli] The Flarum extension's directory

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/generate/migration.ts](https://github.com/flarum/flarum-cli/blob/v0.0.0/src/commands/generate/migration.ts)_

## `flarum-cli help [COMMAND]`

display help for flarum-cli

```
USAGE
  $ flarum-cli help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.2/src/commands/help.ts)_

## `flarum-cli infra:backend-testing [PATH]`

add/update backend testing infrastructure

```
USAGE
  $ flarum-cli infra:backend-testing [PATH]

ARGUMENTS
  PATH  [default: /home/Programming/Projects/flarum/flarum-cli] The Flarum extension's directory

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/infra/backend-testing.ts](https://github.com/flarum/flarum-cli/blob/v0.0.0/src/commands/infra/backend-testing.ts)_

## `flarum-cli init [PATH]`

create a new Flarum extension

```
USAGE
  $ flarum-cli init [PATH]

ARGUMENTS
  PATH  [default: /home/Programming/Projects/flarum/flarum-cli] The Flarum extension's directory

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/init.ts](https://github.com/flarum/flarum-cli/blob/v0.0.0/src/commands/init.ts)_

## `flarum-cli update:js-imports [PATH]`

updates JS imports from core to use proper namespaces

```
USAGE
  $ flarum-cli update:js-imports [PATH]

ARGUMENTS
  PATH  [default: /home/Programming/Projects/flarum/flarum-cli] The Flarum extension's directory

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/update/js-imports.ts](https://github.com/flarum/flarum-cli/blob/v0.0.0/src/commands/update/js-imports.ts)_
<!-- commandsstop -->
