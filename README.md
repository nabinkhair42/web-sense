# WebSense

An agentic search pipeline that combines Google Custom Search with local LLM synthesis via LM Studio.

## Features

- **Search**: Query Google CSE for relevant web results
- **Scrape**: Extract clean content using Readability
- **Synthesize**: Generate coherent answers with local LLM
- **Budget**: Smart context management for optimal performance

## Quick Start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   ```bash
   cp env.example .env
   # Edit .env with your API keys
   ```

3. **Start development server**

   ```bash
   npm run dev
   ```

4. **Test endpoints**

   ```bash
   # Health check
   curl http://localhost:3000/v1/health

   # Answer query
   curl -X POST http://localhost:3000/v1/answer \
     -H "Content-Type: application/json" \
     -d '{"query": "What is TypeScript?"}'
   ```

## Environment Variables

- `GOOGLE_CSE_API_KEY`: Google Custom Search API key
- `GOOGLE_CSE_CX`: Google Custom Search Engine ID
- `LMSTUDIO_BASE_URL`: LM Studio API endpoint (default: http://localhost:1234/v1)
- `LMSTUDIO_MODEL`: Model name to use
- `LMSTUDIO_API_KEY`: Optional API key for LM Studio

## Development

- `npm run dev`: Start development server with hot reload
- `npm run build`: Build for production
- `npm run test`: Run tests
- `npm run lint`: Lint code
- `npm run type-check`: Type check without building

## Architecture

The project follows a clean architecture pattern with clear separation of concerns:

- **Routes**: HTTP endpoint definitions
- **Controllers**: Request/response handling
- **Services**: Business logic orchestration
- **Adapters**: External service integrations
- **Domain**: Core models and interfaces
- **Utils**: Helper functions and utilities

## Next Steps

The current implementation includes the project structure and placeholder services. Next phases will implement:

1. Google CSE search adapter
2. Content scraping with Readability
3. LM Studio LLM client
4. Full pipeline orchestration
5. Error handling and retries
6. Testing and validation
