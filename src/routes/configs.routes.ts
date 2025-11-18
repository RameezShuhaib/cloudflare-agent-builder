import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ConfigService } from '../services/config.service';
import {
  CreateConfigDTO,
  PatchConfigDTO,
  ReplaceConfigDTO,
  UpdateConfigVariableDTO,
} from '../schemas/dtos';

type Variables = {
  configService: ConfigService;
};

export function configRoutes() {
  const app = new Hono<{ Variables: Variables }>();

  app.post('/', zValidator('json', CreateConfigDTO), async (c) => {
    try {
      const configService = c.get('configService');
      const dto = c.req.valid('json');
      const config = await configService.createConfig(dto);
      return c.json(config, 201);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  });

  app.get('/', async (c) => {
    try {
      const configService = c.get('configService');
      const configs = await configService.listConfigs();
      return c.json(configs);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.get('/:id', async (c) => {
    try {
      const configService = c.get('configService');
      const id = c.req.param('id');
      const config = await configService.getConfig(id);
      if (!config) {
        return c.json({ error: 'Config not found' }, 404);
      }
      return c.json(config);
    } catch (error: any) {
      return c.json({ error: error.message }, 404);
    }
  });

  app.patch('/:id', zValidator('json', PatchConfigDTO), async (c) => {
    try {
      const configService = c.get('configService');
      const id = c.req.param('id');
      const dto = c.req.valid('json');
      const config = await configService.patchConfig(id, dto);
      return c.json(config);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  });

  app.put('/:id', zValidator('json', ReplaceConfigDTO), async (c) => {
    try {
      const configService = c.get('configService');
      const id = c.req.param('id');
      const dto = c.req.valid('json');
      const config = await configService.replaceConfig(id, dto);
      return c.json(config);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  });

  app.delete('/:id', async (c) => {
    try {
      const configService = c.get('configService');
      const id = c.req.param('id');
      await configService.deleteConfig(id);
      return c.json({ message: 'Config deleted successfully' });
    } catch (error: any) {
      return c.json({ error: error.message }, 404);
    }
  });

  app.get('/:id/variables/:key', async (c) => {
    try {
      const configService = c.get('configService');
      const id = c.req.param('id');
      const key = c.req.param('key');
      const value = await configService.getConfigVariable(id, key);
      return c.json({ key, value });
    } catch (error: any) {
      return c.json({ error: error.message }, 404);
    }
  });

  app.put('/:id/variables/:key', zValidator('json', UpdateConfigVariableDTO), async (c) => {
    try {
      const configService = c.get('configService');
      const id = c.req.param('id');
      const key = c.req.param('key');
      const { value } = c.req.valid('json');
      await configService.setConfigVariable(id, key, value);
      return c.json({ message: 'Variable updated successfully', key, value });
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  });

  app.delete('/:id/variables/:key', async (c) => {
    try {
      const configService = c.get('configService');
      const id = c.req.param('id');
      const key = c.req.param('key');
      await configService.deleteConfigVariable(id, key);
      return c.json({ message: 'Variable deleted successfully', key });
    } catch (error: any) {
      return c.json({ error: error.message }, 404);
    }
  });

  return app;
}
