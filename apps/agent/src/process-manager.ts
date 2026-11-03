import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export type ManagedProcess = {
  name: string;
  pid: number | null;
  command: string;
  args: string[];
  child: ChildProcessWithoutNullStreams | null;
  enabled: boolean;
};

export type ProcessStartOptions = {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
};

export class ProcessManager {
  private readonly processes = new Map<string, ManagedProcess>();

  async startProcess({ name, command, args = [], env = {}, enabled = true }: ProcessStartOptions): Promise<ManagedProcess> {
    const existing = this.processes.get(name);

    if (existing?.child && !existing.child.killed) {
      return existing;
    }

    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const record: ManagedProcess = {
      name,
      pid: child.pid ?? null,
      command,
      args,
      child,
      enabled,
    };

    child.stdout?.on('data', (chunk) => {
      process.stdout.write(`[${name}] ${chunk.toString()}`);
    });

    child.stderr?.on('data', (chunk) => {
      process.stderr.write(`[${name}] ${chunk.toString()}`);
    });

    child.on('exit', () => {
      this.processes.delete(name);
    });

    this.processes.set(name, record);
    return record;
  }

  async stopProcess(name: string): Promise<void> {
    const process = this.processes.get(name);

    if (!process?.child) {
      this.processes.delete(name);
      return;
    }

    process.child.kill('SIGTERM');
    this.processes.delete(name);
  }

  list(): ManagedProcess[] {
    return [...this.processes.values()];
  }
}
