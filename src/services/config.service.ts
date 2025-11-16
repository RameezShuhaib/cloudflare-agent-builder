import { ConfigRepository } from '../repositories/config.repository';
import type { CreateConfigDTO, PatchConfigDTO, ReplaceConfigDTO } from '../schemas/dtos';
import type { ConfigModel } from '../domain/entities';

export class ConfigService {
  constructor(
    private configRepo: ConfigRepository,
    private kv: KVNamespace
  ) {}

  async createConfig(dto: CreateConfigDTO): Promise<ConfigModel & { variables: Record<string, any> }> {
		const config = await this.configRepo.create({
			name: dto.name,
			description: dto.description || null,
		});

    await this.kv.put(`config:${config.id}`, JSON.stringify(dto.variables));

    return {
      ...config,
      variables: dto.variables,
    };
  }

  async getConfig(id: string): Promise<(ConfigModel & { variables: Record<string, any> }) | null> {
    const config = await this.configRepo.findById(id);
    if (!config) {
      return null;
    }

    const variablesJson = await this.kv.get(`config:${id}`);
    const variables = variablesJson ? JSON.parse(variablesJson) : {};

    return {
      ...config,
      variables,
    };
  }

  async listConfigs(): Promise<ConfigModel[]> {
    return await this.configRepo.findAll();
  }

  async patchConfig(id: string, dto: PatchConfigDTO): Promise<ConfigModel & { variables: Record<string, any> }> {
    const existing = await this.getConfig(id);
    if (!existing) {
      throw new Error('Config not found');
    }

    if (dto.variables) {
      const mergedVariables = {
        ...existing.variables,
        ...dto.variables,
      };
      await this.kv.put(`config:${id}`, JSON.stringify(mergedVariables));
    }

    const updated = await this.configRepo.update(id, {
      name: dto.name,
      description: dto.description,
    });

    const variablesJson = await this.kv.get(`config:${id}`);
    const variables = variablesJson ? JSON.parse(variablesJson) : {};

    return {
      ...updated!,
      variables,
    };
  }

  async replaceConfig(id: string, dto: ReplaceConfigDTO): Promise<ConfigModel & { variables: Record<string, any> }> {
    const existing = await this.configRepo.findById(id);
    if (!existing) {
      throw new Error('Config not found');
    }

    if (dto.variables) {
      await this.kv.put(`config:${id}`, JSON.stringify(dto.variables));
    }

    const updated = await this.configRepo.update(id, {
      name: dto.name,
      description: dto.description,
    });

    const variablesJson = await this.kv.get(`config:${id}`);
    const variables = variablesJson ? JSON.parse(variablesJson) : {};

    return {
      ...updated!,
      variables,
    };
  }

  async deleteConfig(id: string): Promise<void> {
    const existing = await this.configRepo.findById(id);
    if (!existing) {
      throw new Error('Config not found');
    }

    await this.kv.delete(`config:${id}`);

    await this.configRepo.delete(id);
  }

  async getConfigVariable(id: string, key: string): Promise<any> {
    const config = await this.getConfig(id);
    if (!config) {
      throw new Error('Config not found');
    }

    if (!(key in config.variables)) {
      throw new Error('Variable not found');
    }

    return config.variables[key];
  }

  async setConfigVariable(id: string, key: string, value: any): Promise<void> {
    const config = await this.getConfig(id);
    if (!config) {
      throw new Error('Config not found');
    }

    const updatedVariables = {
      ...config.variables,
      [key]: value,
    };

    await this.kv.put(`config:${id}`, JSON.stringify(updatedVariables));
  }

  async deleteConfigVariable(id: string, key: string): Promise<void> {
    const config = await this.getConfig(id);
    if (!config) {
      throw new Error('Config not found');
    }

    if (!(key in config.variables)) {
      throw new Error('Variable not found');
    }

    const updatedVariables = { ...config.variables };
    delete updatedVariables[key];

    await this.kv.put(`config:${id}`, JSON.stringify(updatedVariables));
  }

  async getConfigVariables(configId: string | null | undefined): Promise<Record<string, any>> {
    if (!configId) {
      return {};
    }

    const config = await this.getConfig(configId);
    if (!config) {
      return {};
    }

    return config.variables;
  }
}
