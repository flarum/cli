<p align=center><img alt="flarum-cli" width=100 src="https://user-images.githubusercontent.com/20267363/127189519-ed809abd-5990-40b1-96a7-8d3156b78c3e.png"></p>
<h1 align=center>Flarum CLI</h1><p align=center>
A CLI for developing Flarum extensions</p>

<p align=center>
<a href="https://oclif.io"><img alt"oclif" src="https://img.shields.io/badge/cli-oclif-brightgreen.svg"></a>
<a href="https://npmjs.org/package/@flarum/cli"><img alt"Version" src="https://img.shields.io/npm/v/@flarum/cli.svg"></a>
<a href="https://npmjs.org/package/@flarum/cli"><img alt"Downloads/week" src="https://img.shields.io/npm/dw/@flarum/cli.svg"></a>
<a href="https://github.com/flarum/cli/blob/master/package.json"><img alt"License" src="https://img.shields.io/npm/l/@flarum/cli.svg"></a>
<br>
<img width=720 src="https://sycho9.github.io/flarum-cli.svg" alt="terminal_example">
</p>

- [Introduction](#introduction)
- [Installation](#installation)
- [Updating](#updating)
- [Usage](#usage)
- [Commands](#commands)

## Introduction

One of our core values is **_Framework First_**, Flarum is as much a framework for extension development as it is a forum platform.

This tool was built to simplify the development of Flarum extensions by automating some repetitive and menial tasks. It allows to generate boilerplate skeleton for a new extension, common backend classes and frontend components, extenders, as well as other maintenance tasks.

## Installation

<!-- installation -->

```sh-session
$ npm install -g @flarum/cli
```

<!-- installationstop -->

## Updating

<!-- updating -->

```sh-session
$ npm update -g @flarum/cli
```

<!-- updatingstop -->

## Usage

<!-- usage -->
```sh-session
$ npm install -g @flarum/cli
$ flarum-cli COMMAND
running command...
$ flarum-cli (-v|--version|version)
@flarum/cli/2.0.0-beta.17 linux-x64 node-v16.13.2
$ flarum-cli --help [COMMAND]
USAGE
  $ flarum-cli COMMAND
...
```
<!-- usagestop -->

You can also use `fl` instead of `flarum-cli` as a shorthand.

To see a list of available commands, run:

```sh-session
flarum-cli
```

or

```sh-session
flarum-cli --help
```

## Commands

The CLI has different types of commands for different tasks:

**Initialisation**

- `flarum-cli init [PATH]`: Generates a blank extension skeleton, including all recommended infrastructure.

**Infrastructure**: See the [infrastructure](#infrastructure-modules) section for more information.

- `flarum-cli infra [MODULE] [PATH]`: Adds (or updates) infrastructure for some part of extension infrastructure. You can see all available modules by running `fl-dev infra --help`.

**Audit**: These commands help you make sure your extension is up to date.

- `flarum-cli audit infra [--monorepo] [--fix]` Check that infrastructure files are up to date for all enabled modules.

**Backend Boilerplate Generation**: Generates different types of backend classes and/or extenders, ready to be used.

- `flarum-cli make backend api-controller [PATH]`
- `flarum-cli make backend api-serializer [PATH]`
- `flarum-cli make backend api-serializer-attributes [PATH]`
- `flarum-cli make backend command [PATH]`
- `flarum-cli make backend event-listener [PATH]`
- `flarum-cli make backend handler [PATH]`
- `flarum-cli make backend integration-test [PATH]`
- `flarum-cli make backend job [PATH]`
- `flarum-cli make backend migration [PATH]`
- `flarum-cli make backend model [PATH]`
- `flarum-cli make backend policy [PATH]`
- `flarum-cli make backend repository [PATH]`
- `flarum-cli make backend route [PATH]`
- `flarum-cli make backend service-provider [PATH]`
- `flarum-cli make backend validator [PATH]`

**Frontend Boilerplate Generation**: Generate frontend components/classes, ready to be used.

- `flarum-cli make frontend component [PATH]`
- `flarum-cli make frontend modal [PATH]`
- `flarum-cli make frontend model [PATH]`

**Code Updates**: These commands help update extensions for newer versions of Flarum.

- `flarum-cli update js-imports [PATH]`: Adds admin/forum/common namespaces to all JS imports from flarum core.

_And of course, you can always use the help command to see a list of all available commands with their descriptions:_

- `flarum-cli help [COMMAND]`

All commands can use a `--no-interaction` flag to proceed with default values for prompts when possible.

## 🔥 The Most Powerful Commands

Of all the aforementioned commands, the two most powerful ones that will make a huge difference, are the extension initialisation command and the backend **model** generation command. The former obviously allows to kickstart the extension with the recommended skeleton from the Core Dev team, while the latter not only creates the backend model, it allows to create all the classes related to the model, from just its name:

- Table migration
- Policy
- API Serializer
- CRUD API Controllers
- CRUD Handlers
- Repository
- Validator
- Routes
- Related Extenders

[center]
![terminal_example](https://sycho9.github.io/flarum-cli.svg)
![example_project_with_model_command](https://lh3.googleusercontent.com/-fUnfqQ7rwyo/YQVwwm0sa0I/AAAAAAAAFfE/-o9B30M2gE8y6d3NWaVgBhYa8xEwqLuNwCLcBGAsYHQ/s16000/Screenshot%2Bfrom%2B2021-07-31%2B16-46-38.png)
[/center]

## Infrastructure Modules

If you maintain more than just a few extensions, keeping the infrastructure up to date can be very tedious.
We heavily value developer experience, and make it a point to support automated testing, static analysis, formatting, and other tools
that help you work more happily and efficiently. However, all this means that there's a lot of config files to keep track of.

The idea behind Flarum CLI's infrastructure modules is simple: the config for some feature is associated with a "module".
For example, the "typescript" module includes:

- The `js/tsconfig.json` file
- Dependency reqs for `typescript`, `typescript-coverage-report`, and `flarum-tsconfig` in the `package.json` file.
- Script configuration to check type safety and type coverage in the `package.json` file.

So to enable the `typescript` module, all Flarum CLI has to do is update those files and JSON config keys to the latest version.

Please note that running `flarum-cli infra` or `flarum-cli audit infra --fix` will only add new files/keys and overwrite existing ones; it will not delete old files or config keys.

Also, we strongly recommend carefully looking over the changes made by these commands before committing them: they should work the vast majority of the time, but there could be some corner cases.

### Excluding Files

Sometimes, you'll want to customize some of these configuration files, and prevent `flarum-cli infra [MODULE]` or `flarum-cli audit infra --fix` from overriding your changes. You can also exclude any files from these updates by adding their relative path to the "extra.flarum-cli.excludeScaffolding" key's array in your extension's `composer.json` file. For example, if you wanted to exclude your tsconfig file from any updates by the infra system, your `composer.json` should look as follows:

```json
{
  ...
  "extra": {
    "flarum-cli": {
      "excludeScaffolding": [
        "js/tsconfig.json"
      ],
      "excludeScaffoldingConfigKeys": {
        "composer.json": [
          "scripts.test:setup"
        ],
      ...
    },
    ...
  }
  ...
}
```

## For Maintainers

This section is for maintainers of the flarum-cli codebase.

### Key Concepts

CLI commands are implemented by [oclif](https://oclif.io/) commands. Reference their documentation for information about the command layer.

Since there's a wide range of stuff that we might want to generate, in Flarum CLI, commands are just a layer for user interaction.
The base command is implemented at [src/base-command.ts](https://github.com/flarum/cli/blob/3c90d6321f4750aef954c9d6157b13603d9cfdef/src/base-command.ts#L28-L28), and as you can see, the basic process of all commands is:

1. Show a welcome message
2. Get the path of the parent Flarum extension, or fail if not in one
3. Confirm we are in the right directory
4. Confirm that files will be overwritten / clear files as needed
5. Run a set of registered steps
6. Tell the user which steps ran, or display any errors
7. Show a goodbye message

Actual functionality is implemented at the step layer.

### PHP Subsystem

As a quick side note, the `php-subsystem` subdirectory contains a small PHP project that uses the excellent `nikic/php-parser` library to add extenders to `extend.php`.

The "add extenders" feature is effectively a function that receives current extend.php contents and an extender spec, and returns new extend.php contents.
In the frontend, there's an interface called `ExtenderDef` which encodes a format for generating extenders.

More documentation (and functionality!) will be added later.

### Steps and the Step Manager

#### What are steps?

Steps represent meaningful, granular operations. Some are bigger and some are smaller, but they include:

- Initializing an extension from boilerplate
- Updating some part of an extension from boilerplate (like adding backend testing)
- Adding an extender to extend.php
- Creating a template code file from a stub
- Running `composer install`

In general, tasks should be divided into steps on groups of reusability and optionality.
If some part of a task is optional, it should probably be a step.
If some subtask might be needed by multiple commands, that should be a step too.

The actual logic of a step is implemented in the async `run` method. This method takes:

- An in-memory filesystem object (through `mem-fs`)
- A paths object, which is a class that can be used to get paths relative to the extension root, the working directory, the requested directory (if the command was run with the `path` arg specified), and the monorepo directory (if in a subdirectory of a monorepo).
- An `io` instance, which can be used to prompt the user for input or display outputs / errors.
- An object of "providers", which represent additional functionality. For Flarum commands, these are:
  - A "php provider", which can be used to interact with the PHP subsystem to add extenders to extend.php.

Steps should modify the in-memory filesystem with their changes and return it.

Steps also declare a human-readable type, a list of parameters that they expose to other steps, a method to get those exposed parameters, and whether they are composable.

### What is the Step Manager?

Commands have a `steps` method, where each comment implements a chain of events via a fluent API.

This fluent API is accomplished through the Step Manager class, and supports useful features like:

- Optional steps, with options to configure a confirmation message and whether the default prompt value should be to run or not to run the step.
- Sharing parameters between steps. For example, if one step creates an event listener and a second step adds that listener to extend.php, we can share information about the created listener class from the first step to the second step, and don't need to prompt the user for it again.
- Step dependencies. If a step receives parameters from other steps, any of those are optional and don't run, the step in question won't even attempt to run.

Sharing parameters is done via the following process:

- The source step is declared via the `namedStep` method
- The consuming step includes a list of dependencies, which include
  - Which step they are getting the param from
  - What the param is exposed as in the source step
  - What the param is consumed at
  - If the param value is falsy, should the consumer step run at all? Useful for variable dependencies.

For example:

```ts
(new StepManager())
  .step(stubStepFactory('Standalone'))
  .step(stubStepFactory('Standalone'))
  .namedStep('model', stubStepFactory('Generate Model', true, [], { modelClass: 'Something' }))
  .step(stubStepFactory('Generate Controller'), { optional: false }, [{
    sourceStep: 'model',
    exposedName: 'modelClass',
  }])
  .step(stubStepFactory('Generate Serializer'), { optional: false }, [{
    sourceStep: 'model',
    exposedName: 'modelClass',
    consumedName: 'targetModelClass',
  }])
  .atomicGroup((stepManager: StepManager) => {
    stepManager
      .namedStep('listener', stubStepFactory('Generate Listener', true, [], { listenerClass: 'Something Else' }))
      .step(stubStepFactory('Listener Extender'), { optional: false }, [
        {
          sourceStep: 'listener',
          exposedName: 'listenerClass',
        },
        {
          sourceStep: 'model',
          exposedName: 'modelClass',
          consumedName: 'isnt_used_here_but_why_not',
          dontRunIfFalsy: true,
        },
      ]);
  })
  .run(new Paths({...}), new PromptsIO(), {php: new PhpProvider(...)});
```

#### Step Composability and Atomic Groups

As noted above, steps should work by modifying and returning an in-memory filesystem.
If possible, steps should NEVER make changes directly to the filesystem.

Having steps work like this means that we can compose sequences of multiple steps, and only save their changes when all have ran.
This way, if something errors, we don't end up creating half-finished changes. This can be done by wrapping steps in a callback by calling the `atomicGroup` method of stepManager.

Unfortunately, some steps `npm install` and `composer update` work by invoking external systems that make changes to the filesystem directly, so they are marked as non-composable.

#### Step Types and Schemas

To avoid repetition, base classes have been introduced for some step types.

Steps for generating extenders should use `src/steps/extenders/base`, where all they need to specify is an extender def and a list of params they need.

Steps for generating templates from php stubs should use `src/steps/stubs/php-base`, where they just need to describe what stub file they use, which params they need, and a recommended namespace where the generated file should be placed.

### Testing

Most of this architecture was driven by TDD and BDD development, allowing for a highly decoupled system.

Any additions of steps, modifications of providers, or changes of functionality of the step manager should be accompanied by unit tests.

The 3 base step types actually provide a simple interface to generate test cases. See the relevant test files for more info.

Since commands directly affect the filesystem, unit tests for them aren't really possible. It would also be quite complex to unit test all commands in addition to all steps. For this reason, commands should be manually tested, but unit tests are not currently required.

### Monorepo Support

Flarum CLI was designed with monorepos in mind.
When registering a step, you can provide it an array of subdirectories to run it in.
For each of these subdirectories, an instance of the step will run with the `paths` object returning the subdirectory as `package()`, and the original root directory as `monorepo()`.

A monorepo should have a `flarum-monorepo.json` file in the root directory with the following (optional) keys:

- `packages.core`: a path to Flarum Core, if present.
- `packages.extensions`: an array of paths to Flarum extensions.
- `packages.composer`: an array of paths to non-extension PHP Composer packages published on Packagist.
- `packages.npm`: an array of paths to non-extension JS/TS packages published on NPM.

### Scaffolding Generation

One powerful use-case of Flarum CLI is creating new extensions, and keeping infrastructure in sync for existing extensions.
For example, if managing 100 extensions, making sure the prettier config is consistent for all of them can be very tedious. Additionally, it can be annoying to have to add TypeScript config to every extension, and it's easy to make mistakes.

For this purpose, Flarum CLI's `Scaffolder` system formalizes the concepts of initializing and updating extension infrastructure.

At the core level, there's a boilerplate directory (`boilerplate/skeleton/extension`) that contains the scaffolding for a new extension.

The scaffolder receives a set of modules, which represent some aspect of infrastructure (e.g. JS, TypeScript, Backend Testing, etc).
Modules can be updatable (e.g. TypeScript) or not (e.g. the core setup of an `extend.php` file).
They can also be togglable (e.g. JS), or not, in which case they are always on.

Modules own files in the scaffolding directory, as well as keys in JSON config files. Every file and key must belong to at least one module. If any keys in a JSON config file belong to a module, all keys must belong to a module; if no keys are owned, the config file is treated like any other file.

Modules also have template params, which are used as variables in the scaffolding.

There's a lot more features and guaruntees than that, see the `Module` interface for more information.

The main benefit to this system is that given this scaffolding / module setup, it is possible to generate steps to initialize a new extension, update/add a module to an existing extension, or audit an extension for any outdated infrastructure. This is how the `init`, `infra`, and `audit infra` commands are implemented.
