function ranKey(stepName: string, packagePath = '') {
  return JSON.stringify([stepName, packagePath]);
}

function paramKey(stepName: string, paramName: string, packagePath = '') {
  return JSON.stringify([stepName, paramName, packagePath]);
}

export class ExposedParamManager {
  protected stepsRan = new Set<string>();
  protected exposedParams = new Map<string, unknown>();

  stepRan(stepName: string, packagePath?: string): boolean {
    return this.stepsRan.has(ranKey(stepName, packagePath));
  }

  has(stepName: string, paramName: string, packagePath?: string): boolean {
    return this.exposedParams.has(paramKey(stepName, paramName, packagePath));
  }

  get<T = unknown>(stepName: string, paramName: string, packagePath?: string): T {
    return this.exposedParams.get(paramKey(stepName, paramName, packagePath)) as T;
  }

  add(stepName: string, params: Record<string, unknown>, packagePath?: string): void {
    this.stepsRan.add(ranKey(stepName, packagePath));
    Object.entries(params).forEach(([paramName, value]) => {
      this.exposedParams.set(paramKey(stepName, paramName, packagePath), value);
    });
  }
}
