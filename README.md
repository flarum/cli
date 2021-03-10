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
* [`flarum-cli augment [FILE]`](#flarum-cli-augment-file)
* [`flarum-cli help [COMMAND]`](#flarum-cli-help-command)
* [`flarum-cli infra:testing [FILE]`](#flarum-cli-infratesting-file)
* [`flarum-cli init [PATH]`](#flarum-cli-init-path)

## `flarum-cli augment [FILE]`

describe the command here

```
USAGE
  $ flarum-cli augment [FILE]

OPTIONS
  -f, --force
  -h, --help       show CLI help
  -n, --name=name  name to print
```

_See code: [src/commands/augment.ts](https://github.com/flarum/flarum-cli/blob/v0.0.0/src/commands/augment.ts)_

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

## `flarum-cli infra:testing [FILE]`

describe the command here

```
USAGE
  $ flarum-cli infra:testing [FILE]

OPTIONS
  -f, --force
  -h, --help       show CLI help
  -n, --name=name  name to print
```

_See code: [src/commands/infra/testing.ts](https://github.com/flarum/flarum-cli/blob/v0.0.0/src/commands/infra/testing.ts)_

## `flarum-cli init [PATH]`

describe the command here

```
USAGE
  $ flarum-cli init [PATH]

ARGUMENTS
  PATH  [default: /home/Programming/Projects/flarum/flarum-cli] The root directory in which to create the Flarum
        extension

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/init.ts](https://github.com/flarum/flarum-cli/blob/v0.0.0/src/commands/init.ts)_
<!-- commandsstop -->
