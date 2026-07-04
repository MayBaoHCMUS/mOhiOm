"""Registry of BYOK text-generation providers with a known OpenAI-compatible endpoint.

Each entry maps a provider id to the base URL and default model used when a user
brings their own API key for that provider. All three currently listed providers
speak the same OpenAI-style chat/completions wire format already implemented in
GeminiService, so no provider-specific request/response handling is needed.
"""

from typing import Dict, TypedDict


class ProviderInfo(TypedDict):
    label: str
    api_url: str
    model: str


TEXT_GEN_PROVIDERS: Dict[str, ProviderInfo] = {
    "gemini": {
        "label": "Gemini",
        "api_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "model": "gemini-2.5-flash",
    },
    "openai": {
        "label": "OpenAI",
        "api_url": "https://api.openai.com/v1",
        "model": "gpt-4o-mini",
    },
    "deepseek": {
        "label": "Deepseek",
        "api_url": "https://api.deepseek.com",
        "model": "deepseek-chat",
    },
}
