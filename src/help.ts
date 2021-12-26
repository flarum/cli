import {Interfaces, Help as HelpDefault} from '@oclif/core';
import chalk from 'chalk';

const COLON_REGEX = /:/g;

function prepCommand(command: Interfaces.Command) {
  return Object.assign({}, command, {id: chalk.green(command.id?.replace(COLON_REGEX, ' ') ?? '')});
}

function prepTopic(topic: Interfaces.Topic) {
  return Object.assign({}, topic, {name: chalk.green(topic.name.replace(COLON_REGEX, ' '))});
}

function colorHeaders(text: string) {
  return text.replace(/(TOPICS|TOPIC|DESCRIPTION|USAGE|COMMANDS|VERSION|ARGUMENTS|OPTIONS)/g, match => {
    return chalk.yellow(match);
  });
}

export default class Help extends HelpDefault {
  protected formatRoot(): string {
    return colorHeaders(super.formatRoot());
  }

  protected formatCommand(command: Interfaces.Command): string {
    return colorHeaders(super.formatCommand(prepCommand(command)));
  }

  protected formatCommands(commands: Interfaces.Command[]): string {
    return colorHeaders(super.formatCommands(commands.map(prepCommand)));
  }

  protected formatTopic(topic: Interfaces.Topic): string {
    return colorHeaders(super.formatTopic(prepTopic(topic)).replace(COLON_REGEX, ' '));
  }

  protected formatTopics(topics: Interfaces.Topic[]): string {
    return colorHeaders(super.formatTopics(topics.map(prepTopic)));
  }
}
