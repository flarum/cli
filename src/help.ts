import { Command, Topic } from '@oclif/config';
import { Help as HelpDefault } from '@oclif/plugin-help';

const COLON_REGEX = /:/g;

export default class Help extends HelpDefault {
  protected formatCommand(command: Command): string {
    return super.formatCommand(Object.assign({}, command, { id: command.id.replace(COLON_REGEX, " ") }));
  }

  protected formatCommands(commands: Command[]): string {
    const spaceSeparated = commands.map(c => Object.assign({}, c, { id: c.id.replace(COLON_REGEX, " ") }));

    return super.formatCommands(spaceSeparated);
  }

  protected formatTopic(topic: Topic): string {
    return super.formatTopic(topic).replace(COLON_REGEX, " ");
  }

  protected formatTopics(topics: Topic[]): string {
    const spaceSeparated = topics.map(t => Object.assign({}, t, { name: t.name.replace(COLON_REGEX, " ") }));

    return super.formatTopics(spaceSeparated);
  }
}
