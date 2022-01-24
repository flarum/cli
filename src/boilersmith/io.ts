import prompt, { PromptObject, PromptType } from 'prompts';
import chalk from 'chalk';

type BooleanPromptType = PromptType & ('confirm' | 'toggle');
type StringPromptType = PromptType & ('text' | 'password' | 'invisible' | 'autocomplete');
type DatePromptType = PromptType & 'date';
type ListPromptType = PromptType & 'list';

export type ParamDef<N extends string = string> = Omit<PromptObject<N>, 'name'> & { name: N; message: string };

export type Message = { type: 'info' | 'warning' | 'error'; message: string };

export interface IO {
  supportsAnsiColor: boolean;

  /**
   * Prompt the user for some input data.
   */
  getParam(param: ParamDef & { type: BooleanPromptType }, noCache?: boolean): Promise<boolean>;
  getParam(param: ParamDef & { type: StringPromptType }, noCache?: boolean): Promise<string>;
  getParam(param: ParamDef & { type: DatePromptType }, noCache?: boolean): Promise<Date>;
  getParam(param: ParamDef & { type: ListPromptType }, noCache?: boolean): Promise<string[]>;
  getParam<T>(param: ParamDef, noCache?: boolean): Promise<T>;

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

type OnCancel = () => void;

export class PromptsIO implements IO {
  public supportsAnsiColor = true;

  protected cache = new Map<string, unknown>();
  protected messages: Message[];
  protected noInteraction: boolean;
  protected onCancel?: OnCancel;
  protected prev?: { val: any; prompt: ParamDef };

  constructor(
    initial: Record<string, unknown> = {},
    messages: Message[] = [],
    noInteraction = false,
    onCancel: OnCancel = () => {
      throw new Error('EEXIT: 0');
    }
  ) {
    this.cache = new Map(Object.entries(initial));
    this.messages = messages;
    this.noInteraction = noInteraction;
    this.onCancel = onCancel;
  }

  async getParam<T>(paramDef: ParamDef, noCache = false): Promise<T> {
    const paramName = paramDef.name as string;

    if (this.cache.has(paramName)) {
      return this.cache.get(paramName) as T;
    }

    let resValue: T;
    if (this.noInteraction) {
      if (paramDef.initial && paramDef.initial instanceof Function) {
        resValue = paramDef.initial(this.prev?.val, this.cache, this.prev?.prompt as PromptObject) as unknown as T;
      } else if (paramDef.type === 'confirm' || paramDef.type === 'toggle') {
        resValue = (paramDef.initial ?? false) as unknown as T;
      } else if ('initial' in paramDef) {
        resValue = paramDef.initial as unknown as T;
      } else {
        return this.error(`No-Interaction mode is on, but input is required for param "${paramName}".`, true);
      }
    } else {
      const res = (await prompt(paramDef, {
        onCancel: this.onCancel,
      })) as Record<string, unknown>;
      resValue = res[paramName] as T;
    }

    if (!noCache) {
      this.cache.set(paramName, resValue);
    }

    this.prev = {
      val: resValue,
      prompt: paramDef,
    };

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
  error(message: string, immediate: true): never;
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
    return new PromptsIO(cache, messages, this.noInteraction, this.onCancel);
  }
}
