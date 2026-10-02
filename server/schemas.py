"""Validated request and annotation models shared by API routes."""
from typing import Literal
from pydantic import BaseModel, Field

class LyricLine(BaseModel):
    id: int
    text: str = Field(min_length=1, max_length=500)


class AnnotationRequest(BaseModel):
    lines: list[LyricLine] = Field(max_length=300)


class AnnotationToken(BaseModel):
    index: int
    surface: str
    reading: str
    is_symbol: bool = False
    base: str
    ruby: str
    suffix: str
    part_of_speech: str
    dictionary_form: str
    normalized_form: str
    inflection_type: str
    inflection_form: str
    meaning: str | None = None
    examples: list[str] = Field(default_factory=list)
    needs_review: bool


class AnnotatedLine(BaseModel):
    id: int
    tokens: list[AnnotationToken]


class ReviewToken(BaseModel):
    index: int = Field(ge=0, le=500)
    surface: str = Field(min_length=1, max_length=500)
    reading: str = Field(default="", max_length=100)
    dictionary_form: str = Field(default="", max_length=500)
    part_of_speech: str = Field(default="", max_length=100)
    is_symbol: bool = False


class ReviewLine(LyricLine):
    tokens: list[ReviewToken] | None = Field(default=None, max_length=500)


class DictionaryRefreshRequest(BaseModel):
    lines: list[ReviewLine] = Field(max_length=300)


class SongReviewRequest(BaseModel):
    song_id: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=160)
    artist: str = Field(default="", max_length=160)
    lines: list[ReviewLine] = Field(min_length=1, max_length=300)


class SegmentationRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    line_text: str = Field(min_length=1, max_length=500)
    segments: list[str] = Field(default_factory=list, max_length=500)


class TokenContext(BaseModel):
    surface: str = Field(default="", max_length=100)
    reading: str = Field(default="", max_length=100)
    dictionary_form: str = Field(default="", max_length=100)
    part_of_speech: str = Field(default="", max_length=100)


class ExplainSelectionRequest(BaseModel):
    selection: str = Field(min_length=1, max_length=100)
    line_text: str = Field(min_length=1, max_length=500)
    previous_line: str = Field(default="", max_length=500)
    next_line: str = Field(default="", max_length=500)
    learner_level: Literal["N5", "N4", "N3", "N2", "N1"] = "N3"
    token: TokenContext | None = None


class SentenceContextLine(BaseModel):
    id: int
    text: str = Field(min_length=1, max_length=500)
    translation: str = Field(default="", max_length=500)
    previous_line: str = Field(default="", max_length=500)
    next_line: str = Field(default="", max_length=500)


class ExplainSentenceBatchRequest(BaseModel):
    lines: list[SentenceContextLine] = Field(min_length=1, max_length=8)


class LocalDictionaryInstallRequest(BaseModel):
    path: str = Field(min_length=1, max_length=2048)


class AiSettingsRequest(BaseModel):
    provider: str = Field(default="deepseek", min_length=1, max_length=40)
    base_url: str = Field(min_length=8, max_length=500)
    model: str = Field(min_length=1, max_length=240)
    api_key: str = Field(default="", max_length=1000)
    input_price: float = Field(default=0, ge=0, le=1_000_000)
    cached_input_price: float = Field(default=0, ge=0, le=1_000_000)
    output_price: float = Field(default=0, ge=0, le=1_000_000)
    currency: str = Field(default="CNY", min_length=3, max_length=12)
    pricing_source: str = Field(default="未获取", max_length=120)
    selected_key_id: str = Field(default="", max_length=100)
    key_name: str = Field(default="", max_length=80)
    delete_key_id: str = Field(default="", max_length=100)
