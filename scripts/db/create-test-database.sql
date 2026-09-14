-- Executado pelo PostgreSQL do Docker Compose apenas na primeira inicialização do volume.
-- Cria o banco usado pelos testes de integração (pnpm test:db). Ver docs/database.md.
CREATE DATABASE fraglens_test;
