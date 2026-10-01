import { useEffect, useRef, useState } from 'react'
import { reconcileModelCatalog } from '../lib/modelRefresh.mjs'

export default function useAiSettings({ setToast, setGuideAiConfigured }) {
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  const [webSettingsOpen, setWebSettingsOpen] = useState(false)
  const [modelsRefreshing, setModelsRefreshing] = useState(false)
  const modelRefreshVersion = useRef(0)
  const [aiSettings, setAiSettings] = useState(null)
  const [aiModels, setAiModels] = useState([])
  const [showAllModels, setShowAllModels] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const [aiSettingsBusy, setAiSettingsBusy] = useState('')
  const [aiSettingsError, setAiSettingsError] = useState('')

  async function openAiSettings() {
    if (!window.utaDesktop?.ai) {
      setWebSettingsOpen(true)
      return
    }
    setAiSettingsOpen(true)
    if (aiSettings) return
    setAiSettingsBusy('load')
    setAiSettingsError('')
    try {
      const loaded = await window.utaDesktop.ai.settings()
      setAiSettings(loaded)
      void refreshAiModels(loaded, true)
    }
    catch (error) { setAiSettingsError(error instanceof Error ? error.message : '无法读取 AI 设置。') }
    finally { setAiSettingsBusy('') }
  }

  async function refreshAiModels(settingsOverride = aiSettings, quiet = false) {
    if (!settingsOverride) return
    const version = ++modelRefreshVersion.current
    setModelsRefreshing(true)
    setAiSettingsError('')
    try {
      const result = await window.utaDesktop.ai.models(settingsOverride)
      if (version !== modelRefreshVersion.current) return
      const models = result.models || []
      setAiModels(models)
      setAiSettings(previous => reconcileModelCatalog(previous, settingsOverride.provider, models))
      if (!quiet) setToast(`已从供应商识别 ${models.length} 个模型。`)
    } catch (error) { if (version === modelRefreshVersion.current) setAiSettingsError(error instanceof Error ? error.message : '模型列表读取失败。') }
    finally { if (version === modelRefreshVersion.current) setModelsRefreshing(false) }
  }

  useEffect(() => {
    if (!window.utaDesktop?.ai) return
    let disposed = false
    window.utaDesktop.ai.settings().then(loaded => {
      if (disposed) return
      setAiSettings(previous => previous || loaded)
      void refreshAiModels(loaded, true)
    }).catch(() => {})
    return () => { disposed = true; modelRefreshVersion.current++ }
  }, [])

  useEffect(() => {
    if (!aiSettingsOpen) return
    const closeOnEscape = event => { if (event.key === 'Escape') setAiSettingsOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [aiSettingsOpen])

  async function saveAiConfiguration(event) {
    event.preventDefault()
    setAiSettingsBusy('save')
    setAiSettingsError('')
    try {
      const saved = await window.utaDesktop.ai.saveSettings(aiSettings)
      setAiSettings(saved)
      setGuideAiConfigured(Boolean(saved.has_api_key))
      setToast('AI 供应商与模型设置已保存在本机。')
      setAiSettingsOpen(false)
    } catch (error) { setAiSettingsError(error instanceof Error ? error.message : 'AI 设置保存失败。') }
    finally { setAiSettingsBusy('') }
  }

  function selectAiProvider(provider) {
    setShowAllModels(false)
    setModelSearch('')
    const defaults = aiSettings.provider_defaults?.[provider] || {}
    const nextSettings = { ...aiSettings, provider, base_url: defaults.base_url || '', model: defaults.model || '', api_key: '', selected_key_id: '', has_api_key: false, input_price: 0, cached_input_price: 0, output_price: 0, currency: 'CNY', pricing_source: '未获取' }
    setAiSettings(nextSettings)
    setAiModels([])
    refreshAiModels(nextSettings, true)
  }

  function selectDiscoveredModel(modelId) {
    const discovered = aiModels.find((item) => item.id === modelId)
    setAiSettings((previous) => ({
      ...previous,
      model: modelId,
      ...(discovered?.input_price != null ? { input_price: discovered.input_price } : {}),
      ...(discovered?.cached_input_price != null ? { cached_input_price: discovered.cached_input_price } : {}),
      ...(discovered?.output_price != null ? { output_price: discovered.output_price } : {}),
      currency: 'CNY',
      pricing_source: discovered?.pricing_source || '供应商未提供',
    }))
  }

  function selectSavedKey(keyId) {
    const next = { ...aiSettings, selected_key_id: keyId, api_key: '', has_api_key: Boolean(keyId) }
    setAiSettings(next)
    refreshAiModels(next, true)
  }

  async function deleteSavedKey() {
    if (!aiSettings.selected_key_id || !window.confirm('删除这个本机 API Key？删除后需要重新填写才能使用。')) return
    setAiSettingsBusy('save')
    try {
      const saved = await window.utaDesktop.ai.saveSettings({ ...aiSettings, api_key: '', selected_key_id: '', delete_key_id: aiSettings.selected_key_id })
      setAiSettings(saved)
      setGuideAiConfigured(false)
      setToast('已删除本机 Key。请选择其他账号或新增。')
      await refreshAiModels(saved, true)
    } catch (error) { setAiSettingsError(error.message) }
    finally { setAiSettingsBusy('') }
  }

  return { aiSettingsOpen, webSettingsOpen, modelsRefreshing, aiSettings, aiModels, showAllModels, modelSearch, aiSettingsBusy, aiSettingsError, setAiSettingsOpen, setWebSettingsOpen, setModelsRefreshing, setAiSettings, setAiModels, setShowAllModels, setModelSearch, setAiSettingsBusy, setAiSettingsError, openAiSettings, refreshAiModels, saveAiConfiguration, selectAiProvider, selectDiscoveredModel, selectSavedKey, deleteSavedKey }
}
