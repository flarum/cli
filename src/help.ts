import { Command, Topic } from '@oclif/config';
import { Help as HelpDefault } from '@oclif/plugin-help';
import chalk from 'chalk';

const COLON_REGEX = /:/g;

function prepCommand(command: Command) {
  return Object.assign({}, command, { id: chalk.green(command.id.replace(COLON_REGEX, " ")) });
}

function prepTopic(topic: Topic) {
  return Object.assign({}, topic, { name: chalk.green(topic.name.replace(COLON_REGEX, " ")) });
}

function colorHeaders(text: string) {
  return text.replace(/(TOPICS|TOPIC|DESCRIPTION|USAGE|COMMANDS|VERSION|ARGUMENTS|OPTIONS)/g, match => {
    return chalk.yellow(match);
  })
}


export default class Help extends HelpDefault {
  protected formatRoot(): string {
    return colorHeaders(super.formatRoot());
  }

  protected formatCommand(command: Command): string {
    return colorHeaders(super.formatCommand(prepCommand(command)));
  }

  protected formatCommands(commands: Command[]): string {
    return colorHeaders(super.formatCommands(commands.map(prepCommand)));
  }

  protected formatTopic(topic: Topic): string {
    return colorHeaders(super.formatTopic(prepTopic(topic)).replace(COLON_REGEX, " "));
  }

  protected formatTopics(topics: Topic[]): string {
    return colorHeaders(super.formatTopics(topics.map(prepTopic)));
  }
}
