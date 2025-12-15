"""
Embedding Service - Abstraction layer for text embedding generation.

WHY:
- Flexible support for multiple embedding providers (OpenAI, Secret AI, Hugging Face, etc.)
- Users choose provider based on cost/performance/privacy
- Consistent interface regardless of backend
- Easy switching between models

HOW:
- Abstract base class defines interface
- Provider-specific adapters implement interface
- Knowledge Base config specifies which provider to use
- Service routes to appropriate adapter

KEY DESIGN PRINCIPLE:
- Model-agnostic code in application layer
- All embedding operations go through this service
- Configuration-driven provider selection

PSEUDOCODE:
-----------

PROVIDER SUPPORT:
-----------------
- OpenAI (text-embedding-ada-002, text-embedding-3-small, text-embedding-3-large)
- Secret AI (proprietary embedding models)
- Hugging Face (sentence-transformers, open-source models)
- Cohere (embed-english-v3.0, embed-multilingual-v3.0)
- Google (text-embedding-gecko, text-embedding-gecko-multilingual)
- AWS Bedrock (Titan Embeddings)
- Azure OpenAI
- Anthropic (if they release embedding models)
- Local models (sentence-transformers running locally)


ABSTRACT BASE CLASS:
--------------------
class EmbeddingAdapter(ABC):
    WHY: Define interface all providers must implement
    HOW: Abstract methods force implementation

    @abstractmethod
    def embed_text(self, text: str) -> list[float]:
        WHY: Generate embedding for single text
        HOW: Call provider API

        INPUT: "How do I reset my password?"
        OUTPUT: [0.123, -0.456, 0.789, ...]  # Vector of size dimensions

    @abstractmethod
    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        WHY: Generate embeddings for multiple texts (efficient)
        HOW: Batch API call

        INPUT: ["text1", "text2", "text3"]
        OUTPUT: [[0.1, 0.2, ...], [0.3, 0.4, ...], [0.5, 0.6, ...]]

        NOTE: Providers have different batch limits
            - OpenAI: 2048 texts per batch
            - Cohere: 96 texts per batch
            - Hugging Face: depends on model

    @abstractmethod
    def get_dimensions(self) -> int:
        WHY: Vector size for this model
        HOW: Model-specific constant

        EXAMPLES:
            - text-embedding-ada-002: 1536
            - text-embedding-3-small: 1536
            - text-embedding-3-large: 3072
            - all-MiniLM-L6-v2: 384
            - all-mpnet-base-v2: 768

    @abstractmethod
    def get_max_tokens(self) -> int:
        WHY: Maximum input length
        HOW: Model-specific limit

        EXAMPLES:
            - OpenAI: 8191 tokens
            - Cohere: 512 tokens
            - Sentence transformers: varies (128-512)


MAIN SERVICE CLASS:
-------------------
class EmbeddingService:
    WHY: Route operations to correct provider
    HOW: Load provider from KB config, delegate to adapter

    def __init__(self):
        self.adapters = {
            "openai": OpenAIEmbeddingAdapter(),
            "secret_ai": SecretAIEmbeddingAdapter(),
            "huggingface": HuggingFaceEmbeddingAdapter(),
            "cohere": CohereEmbeddingAdapter(),
            "google": GoogleEmbeddingAdapter(),
            "aws_bedrock": AWSBedrockEmbeddingAdapter(),
            "azure": AzureOpenAIEmbeddingAdapter(),
            "local": LocalEmbeddingAdapter()
        }

    def get_adapter(self, kb: KnowledgeBase) -> EmbeddingAdapter:
        WHY: Select correct adapter for KB
        HOW: Read provider from KB config

        provider = kb.embedding_config["provider"]

        if provider not in self.adapters:
            raise ValueError(f"Unsupported embedding provider: {provider}")

        adapter = self.adapters[provider]
        adapter.configure(kb.embedding_config)  # Pass model name, API key, etc.

        return adapter

    def embed_text(self, kb: KnowledgeBase, text: str) -> list[float]:
        WHY: Generate embedding for single text
        HOW: Delegate to provider adapter

        adapter = self.get_adapter(kb)

        # Truncate if too long
        max_tokens = adapter.get_max_tokens()
        truncated_text = self._truncate_text(text, max_tokens)

        embedding = adapter.embed_text(truncated_text)

        return embedding

    def embed_chunks(self, kb: KnowledgeBase, chunks: list[Chunk]) -> list[list[float]]:
        WHY: Generate embeddings for multiple chunks (efficient)
        HOW: Batch processing with provider adapter

        adapter = self.get_adapter(kb)
        batch_size = kb.embedding_config.get("batch_size", 100)

        all_embeddings = []

        for batch in chunks_batched(chunks, batch_size):
            texts = [chunk.content for chunk in batch]

            # Truncate texts if needed
            max_tokens = adapter.get_max_tokens()
            truncated_texts = [self._truncate_text(text, max_tokens) for text in texts]

            embeddings = adapter.embed_batch(truncated_texts)
            all_embeddings.extend(embeddings)

            # Track generation metrics
            for chunk, embedding in zip(batch, embeddings):
                chunk.embedding_metadata = {
                    "model": kb.embedding_config["model"],
                    "provider": kb.embedding_config["provider"],
                    "dimensions": len(embedding),
                    "generated_at": datetime.utcnow().isoformat(),
                    "generation_time_ms": 0  # Track in production
                }

        return all_embeddings

    def _truncate_text(self, text: str, max_tokens: int) -> str:
        WHY: Prevent exceeding model limits
        HOW: Use tokenizer to count and truncate

        # Simple approximation: 1 token ≈ 4 characters
        # For production, use tiktoken or provider tokenizer
        max_chars = max_tokens * 4

        if len(text) <= max_chars:
            return text

        return text[:max_chars]

    def validate_embedding_config(self, config: dict) -> bool:
        WHY: Verify config before creating KB
        HOW: Check provider, model, dimensions are valid

        required_fields = ["provider", "model", "dimensions"]
        for field in required_fields:
            if field not in config:
                raise ValueError(f"Missing required field: {field}")

        provider = config["provider"]
        if provider not in self.adapters:
            raise ValueError(f"Unsupported provider: {provider}")

        # Validate model exists for provider
        adapter = self.adapters[provider]
        adapter.configure(config)

        if adapter.get_dimensions() != config["dimensions"]:
            raise ValueError(f"Dimension mismatch: expected {config['dimensions']}, got {adapter.get_dimensions()}")

        return True


OPENAI ADAPTER:
---------------
class OpenAIEmbeddingAdapter(EmbeddingAdapter):
    WHY: Most popular, high quality, easy to use
    HOW: OpenAI Python SDK

    def configure(self, config: dict):
        import openai

        self.model = config["model"]  # e.g., "text-embedding-ada-002"
        openai.api_key = config.get("api_key") or os.getenv("OPENAI_API_KEY")

    def embed_text(self, text: str) -> list[float]:
        import openai

        response = openai.Embedding.create(
            model=self.model,
            input=text
        )

        embedding = response["data"][0]["embedding"]
        return embedding

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        import openai

        # OpenAI supports up to 2048 texts per batch
        if len(texts) > 2048:
            raise ValueError("Batch size exceeds OpenAI limit (2048)")

        response = openai.Embedding.create(
            model=self.model,
            input=texts
        )

        embeddings = [item["embedding"] for item in response["data"]]
        return embeddings

    def get_dimensions(self) -> int:
        dimensions_map = {
            "text-embedding-ada-002": 1536,
            "text-embedding-3-small": 1536,
            "text-embedding-3-large": 3072
        }
        return dimensions_map.get(self.model, 1536)

    def get_max_tokens(self) -> int:
        return 8191


SECRET AI ADAPTER:
------------------
class SecretAIEmbeddingAdapter(EmbeddingAdapter):
    WHY: Platform integration, privacy-focused
    HOW: Secret AI API (similar to OpenAI)

    def configure(self, config: dict):
        self.model = config["model"]
        self.api_key = config.get("api_key") or os.getenv("SECRET_AI_API_KEY")
        self.base_url = config.get("base_url", "https://api.secret.ai/v1")

    def embed_text(self, text: str) -> list[float]:
        import requests

        response = requests.post(
            f"{self.base_url}/embeddings",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={"model": self.model, "input": text}
        )

        response.raise_for_status()
        data = response.json()

        embedding = data["data"][0]["embedding"]
        return embedding

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        import requests

        response = requests.post(
            f"{self.base_url}/embeddings",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={"model": self.model, "input": texts}
        )

        response.raise_for_status()
        data = response.json()

        embeddings = [item["embedding"] for item in data["data"]]
        return embeddings

    def get_dimensions(self) -> int:
        # Secret AI specific dimensions
        dimensions_map = {
            "secret-embed-v1": 768,
            "secret-embed-v2": 1024
        }
        return dimensions_map.get(self.model, 768)

    def get_max_tokens(self) -> int:
        return 512


HUGGING FACE ADAPTER:
---------------------
class HuggingFaceEmbeddingAdapter(EmbeddingAdapter):
    WHY: Open-source, free, privacy (can run locally)
    HOW: sentence-transformers library

    def configure(self, config: dict):
        from sentence_transformers import SentenceTransformer

        self.model_name = config["model"]  # e.g., "all-MiniLM-L6-v2"
        self.model = SentenceTransformer(self.model_name)

    def embed_text(self, text: str) -> list[float]:
        embedding = self.model.encode(text)
        return embedding.tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        embeddings = self.model.encode(texts)
        return embeddings.tolist()

    def get_dimensions(self) -> int:
        dimensions_map = {
            "all-MiniLM-L6-v2": 384,
            "all-mpnet-base-v2": 768,
            "multi-qa-mpnet-base-dot-v1": 768,
            "paraphrase-multilingual-MiniLM-L12-v2": 384
        }
        return dimensions_map.get(self.model_name, 768)

    def get_max_tokens(self) -> int:
        return 512


COHERE ADAPTER:
---------------
class CohereEmbeddingAdapter(EmbeddingAdapter):
    WHY: Good multilingual support, competitive pricing
    HOW: Cohere Python SDK

    def configure(self, config: dict):
        import cohere

        self.model = config["model"]  # e.g., "embed-english-v3.0"
        self.client = cohere.Client(config.get("api_key") or os.getenv("COHERE_API_KEY"))

    def embed_text(self, text: str) -> list[float]:
        response = self.client.embed(
            texts=[text],
            model=self.model,
            input_type="search_document"
        )

        embedding = response.embeddings[0]
        return embedding

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        # Cohere batch limit: 96 texts
        if len(texts) > 96:
            raise ValueError("Batch size exceeds Cohere limit (96)")

        response = self.client.embed(
            texts=texts,
            model=self.model,
            input_type="search_document"
        )

        embeddings = response.embeddings
        return embeddings

    def get_dimensions(self) -> int:
        dimensions_map = {
            "embed-english-v3.0": 1024,
            "embed-multilingual-v3.0": 1024,
            "embed-english-light-v3.0": 384
        }
        return dimensions_map.get(self.model, 1024)

    def get_max_tokens(self) -> int:
        return 512


LOCAL ADAPTER (ONNX Runtime):
------------------------------
class LocalEmbeddingAdapter(EmbeddingAdapter):
    WHY: Full privacy, no API costs, offline capability
    HOW: ONNX Runtime with optimized models

    def configure(self, config: dict):
        import onnxruntime as ort
        from transformers import AutoTokenizer

        self.model_name = config["model"]
        model_path = config.get("model_path", f"/models/{self.model_name}")

        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self.session = ort.InferenceSession(f"{model_path}/model.onnx")

    def embed_text(self, text: str) -> list[float]:
        # Tokenize
        inputs = self.tokenizer(text, return_tensors="np", padding=True, truncation=True)

        # Run inference
        outputs = self.session.run(None, dict(inputs))

        # Mean pooling
        embedding = outputs[0].mean(axis=1)[0]

        return embedding.tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        # Tokenize batch
        inputs = self.tokenizer(texts, return_tensors="np", padding=True, truncation=True)

        # Run inference
        outputs = self.session.run(None, dict(inputs))

        # Mean pooling
        embeddings = outputs[0].mean(axis=1)

        return embeddings.tolist()

    def get_dimensions(self) -> int:
        return 768  # Depends on model

    def get_max_tokens(self) -> int:
        return 512


USAGE IN APPLICATION:
---------------------

# Create KB with embedding config
kb = KnowledgeBase(
    name="Product Docs",
    embedding_config={
        "provider": "openai",
        "model": "text-embedding-ada-002",
        "dimensions": 1536,
        "batch_size": 100
    }
)

# Validate config
embedding_service.validate_embedding_config(kb.embedding_config)

# Add documents and generate embeddings
document = upload_document(kb, file)
chunks = chunk_document(document)

# Generate embeddings for all chunks
embeddings = embedding_service.embed_chunks(kb, chunks)

# Store embeddings in database and vector store
for chunk, embedding in zip(chunks, embeddings):
    chunk.embedding = embedding

db.add_all(chunks)
db.commit()

vector_store_service.upsert_chunks(kb, chunks)

# Search with query embedding
query = "How do I reset my password?"
query_embedding = embedding_service.embed_text(kb, query)

results = vector_store_service.search(
    kb=kb,
    query_embedding=query_embedding,
    filters={},
    top_k=5
)


CONTEXTUAL CHUNKING:
--------------------
WHY: Add context to improve retrieval accuracy
HOW: Prepend brief explanation to chunk before embedding

def embed_with_context(kb: KnowledgeBase, chunk: Chunk):
    # Generate context prefix using LLM
    context_prefix = generate_context_prefix(chunk)
    # "This chunk explains how to install dependencies on Linux systems."

    # Prepend context to chunk
    contextualized_text = f"{context_prefix}\n\n{chunk.content}"

    # Generate embedding with context
    embedding = embedding_service.embed_text(kb, contextualized_text)

    # Store context in metadata
    chunk.chunk_metadata["prefix"] = context_prefix

    return embedding


EMBEDDING CACHING:
------------------
WHY: Avoid regenerating embeddings for duplicate content
HOW: Hash content and cache embeddings

def embed_with_cache(kb: KnowledgeBase, chunk: Chunk):
    # Calculate content hash
    content_hash = hashlib.sha256(chunk.content.encode()).hexdigest()

    # Check cache
    cached = redis.get(f"embedding:{content_hash}")
    if cached:
        return json.loads(cached)

    # Generate embedding
    embedding = embedding_service.embed_text(kb, chunk.content)

    # Cache for 30 days
    redis.setex(
        f"embedding:{content_hash}",
        2592000,  # 30 days
        json.dumps(embedding)
    )

    return embedding


BATCH PROCESSING WITH ERROR HANDLING:
--------------------------------------
def embed_chunks_robust(kb: KnowledgeBase, chunks: list[Chunk]):
    embedding_service = EmbeddingService()
    adapter = embedding_service.get_adapter(kb)

    batch_size = kb.embedding_config.get("batch_size", 100)
    all_embeddings = []

    for i, batch in enumerate(chunks_batched(chunks, batch_size)):
        try:
            texts = [chunk.content for chunk in batch]
            embeddings = adapter.embed_batch(texts)
            all_embeddings.extend(embeddings)

            print(f"Batch {i+1}: {len(embeddings)} embeddings generated")

        except Exception as e:
            print(f"Batch {i+1} failed: {e}")

            # Fallback: embed one by one
            for chunk in batch:
                try:
                    embedding = adapter.embed_text(chunk.content)
                    all_embeddings.append(embedding)
                except Exception as e2:
                    print(f"Failed to embed chunk {chunk.id}: {e2}")
                    all_embeddings.append(None)  # Skip this chunk

    return all_embeddings


COST TRACKING:
--------------
def track_embedding_cost(kb: KnowledgeBase, num_tokens: int):
    provider = kb.embedding_config["provider"]
    model = kb.embedding_config["model"]

    # Cost per 1K tokens (example rates)
    cost_map = {
        ("openai", "text-embedding-ada-002"): 0.0001,  # $0.0001 per 1K tokens
        ("openai", "text-embedding-3-small"): 0.00002,
        ("openai", "text-embedding-3-large"): 0.00013,
        ("cohere", "embed-english-v3.0"): 0.0001,
        ("huggingface", "all-MiniLM-L6-v2"): 0.0,  # Free (self-hosted)
    }

    cost_per_1k = cost_map.get((provider, model), 0.0)
    total_cost = (num_tokens / 1000) * cost_per_1k

    # Store in KB metadata
    kb.embedding_metadata = kb.embedding_metadata or {}
    kb.embedding_metadata["total_cost_usd"] = kb.embedding_metadata.get("total_cost_usd", 0.0) + total_cost
    db.commit()

    return total_cost
"""
