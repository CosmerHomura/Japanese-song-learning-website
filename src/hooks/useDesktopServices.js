import { useEffect, useRef, useState } from 'react';
import { dictionaryPanelVisible } from '../lib/dictionaryPanel.mjs';
export default function useDesktopServices({
  setToast
} = {}) {
  const [dictionaryStatus, setDictionaryStatus] = useState(null);
  const [dictionaryPanelOpen, setDictionaryPanelOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);
  const announcedUpdateVersion = useRef('');
  useEffect(() => {
    if (!window.utaDesktop?.dictionary) return undefined;
    let disposed = false;
    let lastPhase = '';
    let timer;
    const schedule = status => {
      window.clearTimeout(timer);
      if (!disposed) timer = window.setTimeout(refresh, ['downloading', 'installing', 'cancelling'].includes(status?.phase) ? 700 : 30000);
    };
    const update = (status, forceOpen = false) => {
      if (disposed || !status) return;
      setDictionaryStatus(previous => JSON.stringify(previous) === JSON.stringify(status) ? previous : status);
      setDictionaryPanelOpen(wasOpen => dictionaryPanelVisible(status, wasOpen, forceOpen));
      if (status.phase === 'ready' && ['downloading', 'installing', 'cancelling'].includes(lastPhase)) setToast('本地词典已安装，可以开始查词。');
      lastPhase = status.phase;
      schedule(status);
    };
    const refresh = () => window.utaDesktop.dictionary.status().then(status => update(status)).catch(() => schedule(null));
    const unsubscribe = window.utaDesktop.dictionary.onStatusChanged(status => update(status, true));
    refresh();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      unsubscribe?.();
    };
  }, []);
  useEffect(() => {
    if (!window.utaDesktop?.updates) return undefined;
    let disposed = false;
    const update = status => {
      if (!disposed && status) setUpdateStatus(status);
    };
    const unsubscribe = window.utaDesktop.updates.onStatusChanged(update);
    window.utaDesktop.updates.status().then(update).catch(() => {});
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);
  useEffect(() => {
    if (updateStatus?.phase !== 'available' || !updateStatus.availableVersion || announcedUpdateVersion.current === updateStatus.availableVersion) return;
    announcedUpdateVersion.current = updateStatus.availableVersion;
    setToast(`UTA ${updateStatus.availableVersion} 已发布，可在设置中下载更新。`);
  }, [updateStatus]);
  async function runUpdateAction(action) {
    try {
      const status = await window.utaDesktop.updates[action]();
      if (status) setUpdateStatus(status);
    } catch (error) {
      setUpdateStatus(previous => ({
        ...previous,
        phase: 'error',
        message: error instanceof Error ? error.message : '更新操作失败。'
      }));
    }
  }
  async function runDictionaryAction(action) {
    if (!window.utaDesktop?.dictionary) return;
    try {
      const status = await window.utaDesktop.dictionary[action]();
      if (status) {
        setDictionaryStatus(status);
        setDictionaryPanelOpen(wasOpen => dictionaryPanelVisible(status, wasOpen, true));
      }
    } catch (error) {
      setDictionaryStatus(previous => ({
        ...(previous || {}),
        phase: 'error',
        error: error instanceof Error ? error.message : '词典操作失败。'
      }));
      setDictionaryPanelOpen(true);
    }
  }
  return {
    dictionaryStatus,
    dictionaryPanelOpen,
    setDictionaryPanelOpen,
    updateStatus,
    runUpdateAction,
    runDictionaryAction
  };
}
