export class TemplateParser {
  // Main entry point - parses any value type
  parse(template: any, context: Record<string, any>): any {
    if (typeof template === 'string') {
      return this.parseString(template, context);
    } else if (Array.isArray(template)) {
      return template.map((item) => this.parse(item, context));
    } else if (typeof template === 'object' && template !== null) {
      return this.parseObject(template, context);
    }
    return template;
  }

  // Parse string templates like "{{parent.node1.data.user_id}}"
  private parseString(template: string, context: Record<string, any>): any {
    // Check if entire string is a template expression
    if (this.isFullTemplateExpression(template)) {
      const path = this.extractPath(template);
      return this.resolvePathExpression(path, context);
    }

    // Handle inline templates: "User {{parent.node1.name}} has ID {{parent.node1.id}}"
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.resolvePathExpression(path.trim(), context);
      return value !== undefined ? String(value) : match;
    });
  }

  // Parse objects recursively
  parseObject(obj: Record<string, any>, context: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.parse(value, context);
    }

    return result;
  }

  // Resolve path expression like "parent.node1.data.user_id"
  private resolvePathExpression(path: string, context: Record<string, any>): any {
    const parts = path.split('.');
    let current: any = context;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Handle array indexing: "items[0]" or "items.0"
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, prop, index] = arrayMatch;
        current = current[prop]?.[parseInt(index)];
      } else {
        current = current[part];
      }
    }

    return current;
  }

  // Check if string is a pure template expression
  private isFullTemplateExpression(str: string): boolean {
    return /^\{\{[^}]+\}\}$/.test(str.trim());
  }

  // Extract path from template expression
  private extractPath(template: string): string {
    return template.replace(/^\{\{|\}\}$/g, '').trim();
  }

  // Extract all variable paths from template
  extractVariables(template: any): string[] {
    const variables: string[] = [];

    const extract = (value: any) => {
      if (typeof value === 'string') {
        const matches = value.matchAll(/\{\{([^}]+)\}\}/g);
        for (const match of matches) {
          variables.push(match[1].trim());
        }
      } else if (Array.isArray(value)) {
        value.forEach(extract);
      } else if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(extract);
      }
    };

    extract(template);
    return [...new Set(variables)];
  }
}
