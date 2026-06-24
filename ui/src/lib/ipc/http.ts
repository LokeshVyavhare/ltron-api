import { invoke } from '@tauri-apps/api/core';
import type { NativeRequest, ExecutionResult } from './types';

export const httpSend = (req: NativeRequest) => invoke<ExecutionResult>('http_send', { req });
export const httpCancel = (executionId: string) =>
  invoke<void>('http_cancel', { executionId });
