import { DefaultProviders } from 'boilersmith/step-manager';
import { PhpProvider } from './php-provider';

export interface FlarumProviders extends DefaultProviders {
  php: PhpProvider;
}
