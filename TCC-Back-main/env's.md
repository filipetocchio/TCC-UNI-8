# env sqlite

# Porta do servidor backend
PORT=8001

# Origens permitidas para CORS (separadas por vírgula)
# Exemplo para desenvolvimento local:
ALLOWED_ORIGINS="http://localhost:8001,http://localhost:3000"
# Exemplo para produção (substitua pelos seus domínios reais):
# ALLOWED_ORIGINS="https://api.meudominio.com,https://meudominio.com"

# URL do frontend (usada como fallback em allowedOrigins.ts)
FRONTEND_URL="http://localhost:3000"
# Em produção, seria algo como:
# FRONTEND_URL="https://meudominio.com"

# Ambiente de execução (development, production, test)
NODE_ENV="development"
# Em produção, mude para: (E tar em um servidor que tenha SSL configurado)
# NODE_ENV="production"

# Segredos para tokens JWT (devem ser strings seguras e únicas)
ACCESS_TOKEN_SECRET="sua_chave_secreta_aqui_1234567890"
REFRESH_TOKEN_SECRET="outra_chave_secreta_aqui_0987654321"

# URL do banco de dados
DATABASE_URL="file:./prisma/dev.db"
# Em produção com um banco remoto (exemplo com PostgreSQL):
# DATABASE_URL="postgresql://usuario:senha@localhost:5432/nome_banco?schema=public"

# Diretório para logs (opcional, padrão é "../logs" se não especificado)
LOGS_DIR="./SRC/logs"

# Configurações adicionais (opcional, para futuro uso)
# Exemplo: tempo de expiração do token (em segundos)
# ACCESS_TOKEN_EXPIRY=3600
