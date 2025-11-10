# Contributing to Agent Builder

Thank you for your interest in contributing to Agent Builder!

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Create a D1 database: `npx wrangler d1 create agent-builder-db`
4. Update `wrangler.jsonc` with your database ID
5. Run migrations: `npm run db:migrate:local`
6. Start development server: `npm run dev`

## Code Structure

- **Repositories**: Data access layer using Drizzle ORM
- **Services**: Business logic layer
- **Orchestration**: Workflow execution engine
- **Executors**: Node executor implementations
- **Routes**: API endpoints using Hono

## Adding a New Node Executor

1. Create executor class in `src/executors/`
2. Implement `NodeExecutor` interface
3. Register in `NodeExecutorFactory`
4. Add to builtin executors in `NodeExecutorService`

Example:

```typescript
import { NodeExecutor } from './node-executor.interface';

export class MyCustomExecutor implements NodeExecutor {
  async execute(config: Record<string, any>, input: Record<string, any>): Promise<any> {
    // Your implementation here
    return result;
  }
}
```

## Testing

Run tests:
```bash
npm test
```

## Code Style

- Use TypeScript
- Follow existing code patterns
- Add JSDoc comments for public APIs
- Use meaningful variable names

## Pull Request Process

1. Create a feature branch
2. Make your changes
3. Add tests if applicable
4. Update documentation
5. Submit a pull request

## Questions?

Open an issue for any questions or concerns.
