import pluralize from 'pluralize';
import s from 'string';

export function pluralSnakeCaseModel(className: string) {
  let name: string;

  name = s(className).underscore().toString();
  name = pluralize((name as string).replace('_', ' ')).replace(' ', '_');

  return name;
}

export function pluralKebabCaseModel(className: string) {
  className = pluralize(className.charAt(0).toLowerCase() + className.slice(1));
  className = s(className).dasherize().s;

  return className;
}
