// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Busca de Despesa por ID
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que recupera os detalhes completos
 * de uma despesa específica, incluindo a lista de todos os pagamentos individuais
 * associados a ela.
 *
 * A consulta é segura e otimizada, garantindo em uma única operação que apenas
 * membros autenticados da propriedade à qual a despesa pertence possam
 * visualizar seus detalhes.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'financial.log';

// Schema para validar o ID da despesa nos parâmetros da rota.
const paramsSchema = z.object({
  expenseId: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0),
});

/**
 * Processa a requisição para buscar os detalhes de uma despesa específica.
 */
export const getExpenseById = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId } = req.user;
    const { expenseId } = paramsSchema.parse(req.params);

    // --- 2. Busca e Autorização em uma Única Consulta (Desempenho e Segurança) ---
    // A consulta busca a despesa e, ao mesmo время, verifica se o usuário
    // requisitante é membro da propriedade, combinando busca e autorização.
    const despesa = await prisma.despesa.findFirst({
      where: {
        id: expenseId,
        propriedade: {
          usuarios: {
            some: {
              idUsuario: userId,
            },
          },
        },
      },
      include: {
        pagamentos: {
          include: {
            cotista: {
              select: { id: true, nomeCompleto: true, email: true },
            },
          },
          orderBy: { cotista: { nomeCompleto: 'asc' } },
        },
      },
    });

    // Se o resultado for nulo, ou a despesa não existe, ou o usuário não tem permissão.
    if (!despesa) {
      return res.status(404).json({ success: false, message: 'Despesa não encontrada ou acesso negado.' });
    }

    // --- 3. Verificação de Permissão de Master (para o Frontend) ---
    // Após confirmar o acesso, verifica se o usuário tem privilégios de master.
    const userPermission = await prisma.usuariosPropriedades.findFirst({
        where: {
            idUsuario: userId,
            idPropriedade: despesa.idPropriedade,
            permissao: 'proprietario_master'
        }
    });
    const currentUserIsMaster = !!userPermission;

    // --- 4. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'Detalhes da despesa recuperados com sucesso.',
      data: {
        ...despesa,
        currentUserIsMaster, // Envia a flag de permissão para o frontend.
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }

    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    logEvents(`ERRO ao buscar detalhes da despesa: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({ success: false, message: 'Ocorreu um erro inesperado no servidor ao buscar a despesa.' });
  }
};