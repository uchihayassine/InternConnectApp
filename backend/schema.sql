-- Run this script in the Supabase SQL Editor before python ingest.py.
-- Embeddings are 768 dimensions (gemini-embedding-001 with output_dimensionality=768).
-- Row Level Security is on and no public policies are created, so only the
-- service role key used by the backend can read or write campus_documents.

create extension if not exists vector;

create table if not exists campus_documents (
  id bigserial primary key,
  content text not null,
  metadata jsonb default '{}'::jsonb,
  embedding vector(768)
);

create index if not exists campus_documents_embedding_idx
  on campus_documents
  using hnsw (embedding vector_cosine_ops);

create or replace function match_documents(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  embedding vector(768),
  similarity float
)
language sql
stable
as $$
  select
    campus_documents.id,
    campus_documents.content,
    campus_documents.metadata,
    campus_documents.embedding,
    (1 - (campus_documents.embedding <=> query_embedding))::float as similarity
  from campus_documents
  where 1 - (campus_documents.embedding <=> query_embedding) > match_threshold
  order by campus_documents.embedding <=> query_embedding
  limit match_count;
$$;

alter table campus_documents enable row level security;
