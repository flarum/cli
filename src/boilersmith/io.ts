import prompt, { Options, PromptObject } from 'prompts';
import { exit } from '@oclif/errors';
import chalk from 'chalk';

export type ParamDef<N extends string = string> = Omit<PromptObject<N>, 'name'> & { name: N };

export type Message = { type: 'info' | 'warning' | 'error', message: string };

export interface IO {
  supportsAnsiColor: boolean;

  /**
   * Prompt the user for some input data.
   */
  getParam<T>(param: ParamDef): Promise<T>;

  /**
   * Check if some data has already been prompted for.
   */
  hasCached(name: string): boolean;

  /**
   * Get all cached params.
   */
  cached(): Record<string, unknown>;

  info(message: string, immediate: boolean): void;
  warning(message: string, immediate: boolean): void;
  error(message: string, immediate: boolean): void;

  /**
   * Get all messages that have been logged non-immediately.
   */
  getOutput(): Message[];

  newInstance(cache: Record<string, unknown>, messages: Message[]): IO;
}

export const PROMPTS_OPTIONS: Options = { onCancel: () => exit() };

export class PromptsIO implements IO {
  public supportsAnsiColor = true;

  private cache = new Map<string, unknown>();
  private messages: Message[] = [];

  constructor(initial: Record<string, unknown> = {}, messages: Message[] = []) {
    this.cache = new Map(Object.entries(initial));
    this.messages = messages;
  }

  async getParam<T>(paramDef: ParamDef): Promise<T> {
    const paramName = paramDef.name as string;

    if (this.cache.has(paramName)) {
      return this.cache.get(paramName) as T;
    }

    const res = (await prompt(paramDef, PROMPTS_OPTIONS)) as Record<string, unknown>;
    const resValue = res[paramName] as T;

    this.cache.set(paramName, resValue);

    return resValue;
  }

  hasCached(name: string): boolean {
    return this.cache.has(name);
  }

  /**
   * @internal
   */
  cached(): Record<string, unknown> {
    return [...this.cache].reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {} as Record<string, unknown>);
  }

  info(message: string, immediate: boolean): void {
    if (immediate) {
      console.log(message);
    } else {
      this.messages.push({ type: 'info', message });
    }
  }

  warning(message: string, immediate: boolean): void {
    const formatted = `${chalk.yellow('Warning:')} ${message}`;
    if (immediate) {
      console.log(formatted);
    } else {
      this.messages.push({ type: 'warning', message: formatted });
    }
  }

  error(message: string, immediate: false): void;
  error(message: string, immediate: true): void;
  error(message: string, immediate: boolean): void {
    const formatted = `${chalk.red('Error:')} ${message}`;
    if (immediate) {
      throw new Error(message);
    } else {
      this.messages.push({ type: 'error', message: formatted });
    }
  }

  getOutput(): Message[] {
    return this.messages;
  }

  newInstance(cache: Record<string, unknown>, messages: Message[]): PromptsIO {
    return new PromptsIO(cache, messages);
  }
}
