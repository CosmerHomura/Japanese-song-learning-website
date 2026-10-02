from fastapi import APIRouter
from server.schemas import AnnotatedLine, AnnotationRequest, SegmentationRequest, DictionaryRefreshRequest
from server.services.annotation import annotate_text, parse_explicit_segments
from server.services.annotation import refresh_dictionary_meanings

router = APIRouter()

@router.post("/api/annotate/meanings")
def refresh_meanings(payload: DictionaryRefreshRequest):
    return refresh_dictionary_meanings(payload.lines)
@router.post("/api/annotate/batch", response_model=list[AnnotatedLine])
def annotate_batch(request: AnnotationRequest) -> list[AnnotatedLine]:
    return [AnnotatedLine(id=line.id, tokens=annotate_text(line.text)) for line in request.lines]


@router.post("/api/annotate/segments")
def reparse_segments(payload: SegmentationRequest):
    return {"tokens": parse_explicit_segments(payload.text, payload.segments)}
