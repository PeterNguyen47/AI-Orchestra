# Knowledge Retrieval

The AO-007 demonstration corpus under `knowledge/enterprise-rag` is original synthetic text with stable source IDs. A strict Zod manifest allowlists relative `.txt` files; absolute paths, traversal, duplicate source IDs, and undeclared files fail closed.

Documents are split deterministically into bounded chunks with stable IDs. Retrieval tokenizes the bounded question and chunks, calculates lexical overlap, applies workflow `topK`, minimum relevance, maximum context characters, and citation requirements, then uses chunk ID as the stable tie breaker. No meaningful overlap returns no result before any provider call.

All document text is untrusted data. AO-007 uses no embeddings, vector database, managed file search, uploads, production/customer/City data, or external retrieval service.
