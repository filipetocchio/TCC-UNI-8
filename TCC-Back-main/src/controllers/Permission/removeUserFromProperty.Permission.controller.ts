// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Exclusão em Massa de Vínculos (Permissões)
 *
 * ########################################################################
 * #                                                                      #
 * #   A L E R T A   D E   S E G U R A N Ç A   E   I M P A C T O   C R Í T I C O   #
 * #                                                                      #
 * ########################################################################
 *
 * Descrição:
 * Este arquivo contém a lógica para um endpoint de exclusão em massa que realiza
 * um "soft delete" em TODOS os vínculos ativos entre usuários e propriedades
 * em TODO o sistema.
 *
 * AO SER ACIONADO, ESTE ENDPOINT IRÁ EFETIVAMENTE RESETAR TODAS AS PERMISSÕES,
 * PROPRIEDADES DE USUÁRIOS E COTAS EM TODA A APLICAÇÃO.
 *
 * Seu uso deve ser restrito a cenários de manutenção de emergência ou testes
 * em ambiente controlado. É ABSOLUTAMENTE CRUCIAL que esta rota seja protegida
 * pelo mais alto nível de autorização (ex: apenas para um superadministrador)
 * e, preferencialmente, não seja exposta em uma API pública.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';

/**
 * ATENÇÃO: Realiza o soft-delete de TODOS os vínculos ativos do sistema.
 */
export const removeUserFromPropertyPermission = async (
  req: Request,
  res: Response
) => {
  try {
    // --- 1. Execução do Soft Delete em Massa ---
    // A operação 'updateMany' é aplicada a todos os registros da tabela
    // 'UsuariosPropriedades' que não possuem o campo 'excludedAt' preenchido.
    const { count } = await prisma.usuariosPropriedades.updateMany({
      where: {
        excludedAt: null,
      },
      data: {
        excludedAt: new Date(),
      },
    });

    // --- 2. Verificação do Resultado e Envio da Resposta ---
    // Se nenhum registro foi alterado, significa que não havia vínculos ativos.
    if (count === 0) {
      // Retorna 200 OK, pois o estado final desejado (nenhum vínculo ativo) foi alcançado.
      return res.status(200).json({
        success: true,
        message: 'Nenhum vínculo ativo foi encontrado para remover.',
      });
    }

    // Retorna uma resposta de sucesso informando quantos vínculos foram afetados.
    return res.status(200).json({
      success: true,
      message: `${count} vínculo(s) de permissão foram removido(s) com sucesso.`,
    });
  } catch (error) {
    // Em produção, este erro deve ser registrado em um sistema de monitoramento.
    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao remover os vínculos.',
    });
  }
};