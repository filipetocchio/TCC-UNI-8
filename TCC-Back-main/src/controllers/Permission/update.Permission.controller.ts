// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Atualização de Permissão de um Membro
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que permite a um "proprietario_master"
 * alterar o nível de permissão de outro membro dentro de uma propriedade.
 *
 * O processo é seguro e otimizado, garantindo que:
 * 1.  Apenas um proprietário master autenticado da propriedade pode executar a ação.
 * 2.  Um master não pode alterar a própria permissão por esta rota.
 * 3.  A ação de rebaixar o último proprietário master é bloqueada.
 * 4.  Um usuário com 0 frações não pode ser promovido a proprietário master.
 * 5.  Uma notificação sobre a mudança é disparada em segundo plano.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'permission.log';

// --- Schemas de Validação ---

const paramsSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

const updatePermissionSchema = z.object({
  permissao: z.enum(['proprietario_master', 'proprietario_comum']),
});

/**
 * Processa a atualização da permissão de um membro em uma propriedade.
 */
export const updatePermission = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: idUsuarioRequisitante, nomeCompleto: nomeRequisitante } = req.user;

    const { id: usuariosPropriedadesId } = paramsSchema.parse(req.params);
    const { permissao: novaPermissao } = updatePermissionSchema.parse(req.body);

    // --- 2. Busca do Vínculo e Validações Iniciais ---
    const vinculoAlvo = await prisma.usuariosPropriedades.findUnique({
      where: { id: usuariosPropriedadesId },
      include: { usuario: { select: { nomeCompleto: true } } },
    });

    if (!vinculoAlvo) {
      return res.status(404).json({ success: false, message: 'O vínculo do membro não foi encontrado.' });
    }
    const { idPropriedade } = vinculoAlvo;

    // --- 3. Verificação de Autorização (Segurança) ---
    const requisitanteIsMaster = await prisma.usuariosPropriedades.findFirst({
      where: {
        idUsuario: idUsuarioRequisitante,
        idPropriedade,
        permissao: 'proprietario_master',
      },
    });

    if (!requisitanteIsMaster) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas proprietários master podem alterar permissões.',
      });
    }

    if (vinculoAlvo.idUsuario === idUsuarioRequisitante) {
        return res.status(400).json({ success: false, message: 'Você não pode alterar sua própria permissão.' });
    }

    // --- 4. Regras de Negócio do Novo Fluxo de Frações ---
    // Regra 4.1: Impede que um usuário com 0 frações seja promovido a master.
    if (novaPermissao === 'proprietario_master' && vinculoAlvo.numeroDeFracoes === 0) {
        return res.status(400).json({
            success: false,
            message: 'Ação bloqueada: Um usuário precisa ter pelo menos 1 fração para ser promovido a proprietário master.'
        });
    }

    // Regra 4.2: Impede o rebaixamento do último master.
    if (vinculoAlvo.permissao === 'proprietario_master' && novaPermissao === 'proprietario_comum') {
      const masterCount = await prisma.usuariosPropriedades.count({
        where: { idPropriedade, permissao: 'proprietario_master' },
      });

      if (masterCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Ação bloqueada: Não é possível rebaixar o último proprietário master da propriedade.',
        });
      }
    }

    // --- 5. Execução da Atualização da Permissão ---
    const vinculoAtualizado = await prisma.usuariosPropriedades.update({
      where: { id: usuariosPropriedadesId },
      data: { permissao: novaPermissao },
    });

    // --- 6. Disparo da Notificação (Desempenho) ---
    createNotification({
      idPropriedade,
      idAutor: idUsuarioRequisitante,
      mensagem: `A permissão de '${vinculoAlvo.usuario.nomeCompleto}' foi alterada para '${novaPermissao}' por '${nomeRequisitante}'.`,
    }).catch(err => {
        logEvents(`Falha ao criar notificação para mudança de permissão: ${err.message}`, LOG_FILE);
    });

    // --- 7. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'A permissão do membro foi atualizada com sucesso.',
      data: vinculoAtualizado,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao atualizar permissão: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);
    
    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao atualizar a permissão.',
    });
  }
};