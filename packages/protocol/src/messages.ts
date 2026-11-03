export type MessageType =
  | 'agent.register'
  | 'agent.heartbeat'
  | 'mcp.request'
  | 'mcp.response'
  | 'error';

export type AgentRegisterMessage = {
  type: 'agent.register';
  version: 1;
  deviceId: string;
  deviceToken?: string;
};

export type AgentHeartbeatMessage = {
  type: 'agent.heartbeat';
  timestamp: number;
};

export type McpRequestMessage = {
  type: 'mcp.request';
  requestId: string;
  payload: unknown;
};

export type McpResponseMessage = {
  type: 'mcp.response';
  requestId: string;
  payload: unknown;
};

export type ErrorMessage = {
  type: 'error';
  requestId?: string;
  code: string;
  message: string;
};

export type ProtocolMessage =
  | AgentRegisterMessage
  | AgentHeartbeatMessage
  | McpRequestMessage
  | McpResponseMessage
  | ErrorMessage;
