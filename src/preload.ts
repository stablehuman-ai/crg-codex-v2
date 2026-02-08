import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './shared/ipc-channels';
import { AppPingResponse } from './shared/types/ipc';

const electronAPI = {
  ping: async (): Promise<AppPingResponse> => ipcRenderer.invoke(IPC_CHANNELS.APP_PING)
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
