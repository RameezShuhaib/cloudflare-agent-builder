import { ConfigRepository } from '../repositories/config.repository';
import type { CreateConfigDTO, PatchConfigDTO, ReplaceConfigDTO } from '../schemas/dtos';
import type { Config } from '../db/schema';

export class ConfigService {
  constructor(
    private configRepo: ConfigRepository,
    private kv: KVNamespace
  ) {}

  async createConfig(dto: CreateConfigDTO): Promise<Config & { variables: Record<string, any> }> {
    // Check if ID already exists
    const exists = await this.configRepo.exists(dto.id);
    if (exists) {
      throw new Error('Config with this ID already exists');
    }

    // Store variables in KV
    await this.kv.put(`config:${dto.id}`, JSON.stringify(dto.variables));

    // Store metadata in D1
    const now = new Date();
    const config = await this.configRepo.create({
      id: dto.id,
      name: dto.name,
      description: dto.description || null,
      createdAt: now,
      updatedAt: now,
    });

    return {
      ...config,
      variables: dto.variables,
    };
  }

  async getConfig(id: string): Promise<(Config & { variables: Record<string, any> }) | null> {
    // Get metadata from D1
    const config = await this.configRepo.findById(id);
    if (!config) {
      return null;
    }

    // Get variables from KV
    const variablesJson = await this.kv.get(`config:${id}`);
    const variables = variablesJson ? JSON.parse(variablesJson) : {};

    return {
      ...config,
      variables,
    };
  }

  async listConfigs(): Promise<Config[]> {
    // Return metadata only (no variables for security)
    return await this.configRepo.findAll();
  }

  async patchConfig(id: string, dto: PatchConfigDTO): Promise<Config & { variables: Record<string, any> }> {
    // Get existing config
    const existing = await this.getConfig(id);
    if (!existing) {
      throw new Error('Config not found');
    }

    // Merge variables if provided
    if (dto.variables) {
      const mergedVariables = {
        ...existing.variables,
        ...dto.variables,
      };
      await this.kv.put(`config:${id}`, JSON.stringify(mergedVariables));
    }

    // Update metadata in D1
    const updated = await this.configRepo.update(id, {
      name: dto.name,
      description: dto.description,
    });

    // Get final variables
    const variablesJson = await this.kv.get(`config:${id}`);
    const variables = variablesJson ? JSON.parse(variablesJson) : {};

    return {
      ...updated!,
      variables,
    };
  }

  async replaceConfig(id: string, dto: ReplaceConfigDTO): Promise<Config & { variables: Record<string, any> }> {
    // Get existing config
    const existing = await this.configRepo.findById(id);
    if (!existing) {
      throw new Error('Config not found');
    }

    // Replace variables completely if provided
    if (dto.variables) {
      await this.kv.put(`config:${id}`, JSON.stringify(dto.variables));
    }

    // Update metadata in D1
    const updated = await this.configRepo.update(id, {
      name: dto.name,
      description: dto.description,
    });

    // Get final variables
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

    // Delete from KV
    await this.kv.delete(`config:${id}`);

    // Delete from D1
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

    // Update single variable
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

    // Remove the key
    const updatedVariables = { ...config.variables };
    delete updatedVariables[key];

    await this.kv.put(`config:${id}`, JSON.stringify(updatedVariables));
  }

  // Get config variables for workflow execution
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
