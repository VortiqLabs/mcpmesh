export class MeshError extends Error {
  constructor(message: string, public readonly code = 'MESH_ERROR') {
    super(message);
    this.name = 'MeshError';
  }
}

export class ConfigurationError extends MeshError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
  }
}
