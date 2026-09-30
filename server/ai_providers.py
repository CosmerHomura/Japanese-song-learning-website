"""Supported API providers and defaults, shared by settings and discovery."""

AI_PROVIDERS = {
    "deepseek": {"label": "DeepSeek", "protocol": "openai", "base_url": "https://api.deepseek.com", "model": "deepseek-chat", "pricing_provider": "deepseek"},
    "openai": {"label": "OpenAI", "protocol": "openai", "base_url": "https://api.openai.com/v1", "model": "gpt-5-mini", "pricing_provider": "openai"},
    "anthropic": {"label": "Anthropic Claude", "protocol": "anthropic", "base_url": "https://api.anthropic.com/v1", "model": "claude-sonnet-4-5", "pricing_provider": "anthropic"},
    "google": {"label": "Google Gemini", "protocol": "gemini", "base_url": "https://generativelanguage.googleapis.com/v1beta", "model": "gemini-2.5-flash", "pricing_provider": "gemini"},
    "xai": {"label": "xAI Grok", "protocol": "openai", "base_url": "https://api.x.ai/v1", "model": "grok-4-fast", "pricing_provider": "xai"},
    "mistral": {"label": "Mistral AI", "protocol": "openai", "base_url": "https://api.mistral.ai/v1", "model": "mistral-small-latest", "pricing_provider": "mistral"},
    "groq": {"label": "Groq", "protocol": "openai", "base_url": "https://api.groq.com/openai/v1", "model": "openai/gpt-oss-20b", "pricing_provider": "groq"},
    "alibaba": {"label": "阿里云百炼（国际）", "protocol": "openai", "base_url": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", "models_url": "https://dashscope-intl.aliyuncs.com/api/v1/models", "model": "qwen-plus", "pricing_provider": "dashscope"},
    "siliconflow": {"label": "硅基流动 SiliconFlow", "protocol": "openai", "base_url": "https://api.siliconflow.cn/v1", "model": "deepseek-ai/DeepSeek-V3.2", "pricing_provider": "siliconflow"},
    "openrouter": {"label": "OpenRouter", "protocol": "openai", "base_url": "https://openrouter.ai/api/v1", "model": "openai/gpt-5-mini", "pricing_provider": "openrouter"},
    "together": {"label": "Together AI", "protocol": "openai", "base_url": "https://api.together.xyz/v1", "model": "openai/gpt-oss-20b", "pricing_provider": "together_ai"},
    "moonshot": {"label": "月之暗面 Kimi", "protocol": "openai", "base_url": "https://api.moonshot.cn/v1", "model": "kimi-k2.5", "pricing_provider": "moonshot"},
    "zhipu": {"label": "智谱 GLM", "protocol": "openai", "base_url": "https://open.bigmodel.cn/api/paas/v4", "model": "glm-4.5-flash", "pricing_provider": "zhipu"},
    "minimax": {"label": "MiniMax", "protocol": "openai", "base_url": "https://api.minimaxi.com/v1", "model": "MiniMax-M2.1", "pricing_provider": "minimax"},
    "nvidia": {"label": "NVIDIA NIM", "protocol": "openai", "base_url": "https://integrate.api.nvidia.com/v1", "model": "meta/llama-3.3-70b-instruct", "pricing_provider": "nvidia_nim"},
    "custom": {"label": "其他 OpenAI 兼容接口", "protocol": "openai", "base_url": "http://127.0.0.1:11434/v1", "model": "local-model", "pricing_provider": ""},
}
AI_PROVIDER_DEFAULTS = {key: {"base_url": value["base_url"], "model": value["model"]} for key, value in AI_PROVIDERS.items()}
