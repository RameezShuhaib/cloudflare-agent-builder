import { Parser } from 'expr-eval'

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

	public eval(expression: string, context: Record<string, any>): any {
		const parser = new Parser()
		parser.functions.getPath = (obj: any, path: any) => {
			if (!obj || !path) return null;
			const keys = path
				.replace(/\[['"]([^'"]+)['"]\]/g, '.$1')
				.replace(/\[(\d+)\]/g, '.$1')
				.split('.')
				.filter((k: any) => k !== '');

			let result = obj;

			for (const key of keys) {
				if (result === null || result === undefined) return null;
				result = result[key];
			}

			return result;
		};

		parser.functions.parse = (template: Record<string, any>) => {
			return this.parse(template, context)
		};

		parser.functions.eval = (expr: string) => {
			return this.eval(expr, context)
		};

		const expr = parser.parse(expression);
		return expr.evaluate(context);
	}

  private parseString(template: string, context: Record<string, any>): any {
    if (this.isFullTemplateExpression(template)) {
      const path = this.extractPath(template);
			return this.eval(path, context)
    }

    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
			return this.eval(path, context)
    });
  }

  parseObject(obj: Record<string, any>, context: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.parse(value, context);
    }

    return result;
  }

  private isFullTemplateExpression(str: string): boolean {
    return /^\{\{[^}]+\}\}$/.test(str.trim());
  }

  private extractPath(template: string): string {
    return template.replace(/^\{\{|\}\}$/g, '').trim();
  }
}
