/**
 * @file index.d.ts
 * @description Estende as declarações de tipo do framework Express para adicionar
 * propriedades customizadas ao objeto Request, garantindo a segurança de tipos
 * em toda a aplicação.
 */
// Todos direitos autorais reservados pelo QOTA.

// Define a estrutura do payload que esperamos do nosso token JWT
interface UserPayload {
  id: number;
  email: string;
}

// Sobrescreve a interface Request do Express para adicionar nossas propriedades customizadas
declare namespace Express {
  export interface Request {
    // Anexa os dados do usuário decodificados do JWT após a autenticação.
    user?: UserPayload;

    // Anexa os papéis/níveis de acesso do usuário, se aplicável no seu sistema.
    // Esta propriedade será populada pelo middleware de autenticação.
    roles?: number[];
  }
}
