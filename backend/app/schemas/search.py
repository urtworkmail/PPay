from pydantic import BaseModel


class SearchResult(BaseModel):
    type: str
    id: str
    label: str
    sublabel: str | None = None
    path: str


class SearchResponse(BaseModel):
    results: list[SearchResult]
