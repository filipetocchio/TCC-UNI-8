// Todos direitos autorais reservados pelo QOTA.

/**
 * Definição das Permissões de Usuário (Roles)
 *
 * Descrição:
 * Este arquivo centraliza a definição dos níveis de acesso do sistema, seguindo
 * uma abordagem de Controle de Acesso Baseado em Funções (RBAC - Role-Based Access Control).
 *
 * Mapeamos nomes de funções legíveis por humanos (como 'Admin') para códigos
 * numéricos, que são mais eficientes para armazenamento e verificação no banco de dados.
 * O arquivo também exporta um tipo TypeScript (`Role`) derivado dinamicamente
 * dessas definições, garantindo a segurança de tipos em todo o código que
 * manipula permissões de usuário.
 */

// Objeto que mapeia os nomes das funções (Roles) para códigos numéricos.
// O uso de `as const` transforma o objeto em uma estrutura imutável (readonly)
// e garante que o TypeScript infira os tipos mais específicos possíveis,
// o que é crucial para a criação do tipo `Role`.
export const ROLES_LIST = {
  Admin: 1000,
  Editor: 100,
  User: 1,
} as const;

// Exporta um tipo dinâmico que representa as chaves do objeto ROLES_LIST.
// Isso cria um tipo de união ('Admin' | 'Editor' | 'User'), garantindo
// que apenas os nomes de roles válidos possam ser utilizados no código.
export type Role = keyof typeof ROLES_LIST;