"""Local Sentence-Transformers Embedding Service."""

import logging
from typing import List, Optional, Callable
import numpy as np
from app import config

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Manages local sentence embedding model inference and normalization."""

    _model_instance = None
    _mock_embedder: Optional[Callable[[List[str]], List[List[float]]]] = None
    _loaded_model_name: Optional[str] = None

    @classmethod
    def set_mock_embedder(
        cls,
        mock_fn: Optional[Callable[[List[str]], List[List[float]]]],
    ) -> None:
        """Inject a test mock embedder returning custom or deterministic vectors."""
        cls._mock_embedder = mock_fn

    @classmethod
    def _get_model(cls):
        """Loads and caches the SentenceTransformer model in memory."""
        if cls._model_instance is not None:
            return cls._model_instance

        model_name = config.EMBEDDING_MODEL
        device = config.EMBEDDING_DEVICE

        try:
            from sentence_transformers import SentenceTransformer

            logger.info("Loading local embedding model: %s on device: %s", model_name, device)
            model = SentenceTransformer(model_name, device=device)
            model.max_seq_length = config.EMBEDDING_MAX_SEQUENCE_LENGTH
            cls._model_instance = model
            cls._loaded_model_name = model_name
            return cls._model_instance
        except Exception as exc:
            logger.error("Failed to load local embedding model '%s': %s", model_name, exc)
            raise RuntimeError(
                f"Embedding model '{model_name}' could not be loaded: {exc}"
            ) from exc

    @classmethod
    def get_dimension(cls) -> int:
        """Returns the configured embedding vector dimension."""
        return config.EMBEDDING_DIMENSION

    @classmethod
    def embed_texts(cls, texts: List[str]) -> List[List[float]]:
        """Generates normalized embedding vectors for a list of passages."""
        if not texts:
            return []

        if cls._mock_embedder is not None:
            vectors = cls._mock_embedder(texts)
            target_dim = cls.get_dimension()
            norm_vectors = []
            for v in vectors:
                if len(v) != target_dim:
                    v = (v + [0.0] * target_dim)[:target_dim]
                arr = np.array(v, dtype=np.float32)
                norm = np.linalg.norm(arr)
                if norm > 0:
                    arr = arr / norm
                norm_vectors.append(arr.tolist())
            return norm_vectors

        model = cls._get_model()
        batch_size = config.EMBEDDING_BATCH_SIZE
        normalize = config.EMBEDDING_NORMALIZE

        embeddings = model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=False,
            normalize_embeddings=normalize,
            convert_to_numpy=True,
        )

        target_dim = cls.get_dimension()
        result: List[List[float]] = []
        for emb in embeddings:
            if emb.shape[0] != target_dim:
                raise ValueError(
                    f"Generated dimension {emb.shape[0]} does not match expected {target_dim}"
                )
            result.append(emb.tolist())

        return result

    @classmethod
    def embed_query(cls, query: str) -> List[float]:
        """Generates a normalized embedding vector for a search query."""
        clean_query = query.strip()
        if not clean_query:
            target_dim = cls.get_dimension()
            return [0.0] * target_dim

        vectors = cls.embed_texts([clean_query])
        return vectors[0]
