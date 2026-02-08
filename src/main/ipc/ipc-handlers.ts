import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { AppPingResponse } from '../../shared/types/ipc';

export const registerIpcHandlers = () => {
  ipcMain.handle(IPC_CHANNELS.APP_PING, (): AppPingResponse => ({ message: 'IPC pong' }));
};
