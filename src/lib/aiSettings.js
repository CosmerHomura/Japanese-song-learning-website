const CONFIG_KEY = 'uta-ai-provider-v1'
const SECRET_KEY = 'uta-ai-key-v1'

export const DEFAULT_AI_SETTINGS = {
  useServerDefault: true, name: 'DeepSeek', protocol: 'deepseek',
  base_url: 'https://api.deepseek.com', model: 'deepseek-flash',
  api_key: '', json_mode: true, rememberKey: false,
}

export function loadAiSettings() {
  try {
    const config = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null') || {}
    const api_key = config.rememberKey ? localStorage.getItem(SECRET_KEY) : sessionStorage.getItem(SECRET_KEY)
    return { ...DEFAULT_AI_SETTINGS, ...config, api_key: api_key || '' }
  } catch { return { ...DEFAULT_AI_SETTINGS } }
}

export function saveAiSettings(settings) {
  const { api_key, ...config } = settings
  // Write the selected store first so quota failures keep the old key intact.
  const destination = settings.rememberKey ? localStorage : sessionStorage
  destination.setItem(SECRET_KEY, settings.useServerDefault ? '' : api_key.trim())
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  const other = settings.rememberKey ? sessionStorage : localStorage
  other.removeItem(SECRET_KEY)
}

export function clearAiSettings() {
  localStorage.removeItem(CONFIG_KEY)
  localStorage.removeItem(SECRET_KEY)
  sessionStorage.removeItem(SECRET_KEY)
}

export function aiRequestHeaders(settings = loadAiSettings()) {
  if (settings.useServerDefault) return {}
  return { 'X-UTA-AI-Config': encodeURIComponent(JSON.stringify({
    name: settings.name.trim(), protocol: settings.protocol,
    base_url: settings.base_url.trim(), model: settings.model.trim(),
    api_key: settings.api_key.trim(), json_mode: settings.json_mode,
  })) }
}
