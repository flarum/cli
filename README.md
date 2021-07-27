<p align=center><img alt="flarum-cli" width=100 src="https://user-images.githubusercontent.com/20267363/127189519-ed809abd-5990-40b1-96a7-8d3156b78c3e.png"></p>
<h1 align=center>Flarum CLI</h1><p align=center>
A CLI for developing Flarum extensions</p>

<p align=center>
<a href="https://oclif.io"><img alt"oclif" src="https://img.shields.io/badge/cli-oclif-brightgreen.svg"></a>
<a href="https://npmjs.org/package/flarum-cli"><img alt"Version" src="https://img.shields.io/npm/v/flarum-cli.svg"></a>
<a href="https://npmjs.org/package/flarum-cli"><img alt"Downloads/week" src="https://img.shields.io/npm/dw/flarum-cli.svg"></a>
<a href="https://github.com/flarum/flarum-cli/blob/master/package.json"><img alt"License" src="https://img.shields.io/npm/l/flarum-cli.svg"></a>
</p>

<!-- toc -->
* [Introduction](#introduction)
* [Installation](#installation)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Introduction
One of our core values is ***Framework First***, Flarum is as much a framework for extension development as it is a forum platform.

This tool was built to simplify the development of Flarum extensions by automating some repetitive and menial tasks. It allows to generate boilerplate skeleton for a new extension, common backend classes and frontend components, extenders, as well as other maintenance tasks.

# Installation
<!-- installation -->
```sh-session
$ npm install -g flarum-cli
```
<!-- installationstop -->

# Usage
<!-- usage -->
```sh-session
$ npm install -g flarum-cli
$ flarum-cli COMMAND
running command...
$ flarum-cli (-v|--version|version)
flarum-cli/1.0.0 linux-x64 node-v14.17.2
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

# Commands
<!-- commands -->
* `flarum-cli generate:backend:api-controller [PATH]`
* `flarum-cli generate:backend:api-serializer [PATH]`
* `flarum-cli generate:backend:api-serializer-attributes [PATH]`
* `flarum-cli generate:backend:command [PATH]`
* `flarum-cli generate:backend:event-listener [PATH]`
* `flarum-cli generate:backend:handler [PATH]`
* `flarum-cli generate:backend:integration-test [PATH]`
* `flarum-cli generate:backend:job [PATH]`
* `flarum-cli generate:backend:migration [PATH]`
* `flarum-cli generate:backend:model [PATH]`
* `flarum-cli generate:backend:policy [PATH]`
* `flarum-cli generate:backend:repository [PATH]`
* `flarum-cli generate:backend:route [PATH]`
* `flarum-cli generate:backend:service-provider [PATH]`
* `flarum-cli generate:backend:validator [PATH]`
* `flarum-cli generate:frontend:modal [PATH]`
* `flarum-cli generate:frontend:model [PATH]`
* `flarum-cli help [COMMAND]`
* `flarum-cli infra:backend-testing [PATH]`
* `flarum-cli init [PATH]`
* `flarum-cli update:js-imports [PATH]`
<!-- commandsstop -->

## For Maintainers

This section is for maintainers of the flarum-cli codebase.

### Key Concepts

CLI commands are implemented by [oclif](https://oclif.io/) commands. Reference their documentation for information about the command layer.

Since there's a wide range of stuff that we might want to generate, in Flarum CLI, commands are just a layer for user interaction.
The base command is implemented at [src/base-command.ts](https://github.com/flarum/flarum-cli/blob/3c90d6321f4750aef954c9d6157b13603d9cfdef/src/base-command.ts#L28-L28), and as you can see, the basic process of all commands is:

1. Show a welcome message
2. Get the path of the parent Flarum extension, or fail if not in one
3. Confirm we are in the right directory
4. Confirm that files will be overwritten / clear files as needed
5. Run a set of registered steps
6. Tell the user which steps ran
7. Show a goodbye message

Actual functionality is implemented at the step layer.

### PHP Subsystem

As a quick side note, the `php-subsystem` subdirectory contains a small PHP project that uses the excellent `nikic/php-parser` library to add extenders to `extend.php`.

The "add extenders" feature is effectively a function that receives current extend.php contents and an extender spec, and returns new extend.php contents.
In the frontend, there's an interface called `ExtenderDef` which encodes a format for generating extenders.

More documentation (and functionality!) will be added later.

### Steps and the Step Manager

#### What are steps?

Steps represent granular operations. Some are bigger and some are smaller, but they include:

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
- A path provider, which is a class that can be used to get paths relative to the extension root, the working directory, the requested directory, and the CLI's boilerplate directory
- A param provider, which can be used to prompt the user for parameters. We'll discuss this more soon.
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
  .run(stubPathProviderFactory(), paramProviderFactory, stubPhpProviderFactory());
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

Steps for `infra` operations (copying over some portion of the default skeleton, for operations like adding/updating backend testing or TypeScript config) shouls use `src/steps/infra/base`, where all they need to indicate is a list of files from the boilerplate they copy over, and an object describing which JSON config keys should be copied from the boilerplate to the extension for various JSON files.

### Testing

Most of this architecture was driven by TDD and BDD development, allowing for a highly decoupled system.

Any additions of steps, modifications of providers, or changes of functionality of the step manager should be accompanied by unit tests.

The 3 base step types actually provide a simple interface to generate test cases. See the relevant test files for more info.

Since commands directly affect the filesystem, unit tests for them aren't really possible. It would also be quite complex to unit test all commands in addition to all steps. For this reason, commands should be manually tested, but unit tests are not currently required.
